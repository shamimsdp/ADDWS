#!/usr/bin/env node
// Builds context/feature-queue.md: what is done, in progress, and what to assign next.
// Inputs: context/feature-list.md (features, dependencies) and
//         context/feature-progress-list.md (per sub-feature status).
// Ranking: features that unblock the most other features come first.
// Usage: node scripts/feature-queue.mjs [--stdout]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const listPath = join(root, 'context', 'feature-list.md');
const progressPath = join(root, 'context', 'feature-progress-list.md');
const outPath = join(root, 'context', 'feature-queue.md');

const ACTIVE = ['Requirements', 'Backend', 'Frontend', 'QA', 'Bug fix'];
const cell = (s) => s.trim();

// ---------- parse feature list ----------
const features = new Map(); // id -> { id, name, priority, stage, stageIndex, deps, subs: [] }
let stage = null;
let stageIndex = -1;
let current = null;
for (const line of readFileSync(listPath, 'utf8').split(/\r?\n/)) {
  if (line.startsWith('## Post-release')) break;
  const st = line.match(/^## (Stage \d+ — .+)$/);
  if (st) { stage = st[1]; stageIndex++; current = null; continue; }
  const fh = line.match(/^### (FEAT-\d{3}) (.+?) — (P\d)\s*$/);
  if (fh) {
    current = { id: fh[1], name: fh[2], priority: fh[3], stage, stageIndex, deps: [], subs: [] };
    features.set(current.id, current);
    continue;
  }
  if (current && line.startsWith('Depends on:')) {
    current.deps = [...line.split('·')[0].matchAll(/FEAT-\d{3}(?:\.\d+)?/g)].map((m) => m[0]);
    current.decisions = [...(line.split('·')[1] ?? '').replace(/\([^)]*decided[^)]*\)/gi, '').matchAll(/D-\d+b?/g)].map((m) => m[0]);
    continue;
  }
  const sub = current && line.match(/^\| (FEAT-\d{3}\.\d+) \|/);
  if (sub) current.subs.push(sub[1]);
}

// ---------- parse progress list ----------
const progress = new Map(); // sub id -> { name, status, be, fe, qa, bugs }
for (const line of readFileSync(progressPath, 'utf8').split(/\r?\n/)) {
  if (!/^\| FEAT-\d{3}\.\d+ \|/.test(line)) continue;
  const c = line.split('|').slice(1, -1).map(cell);
  progress.set(c[0], { name: c[1], status: c[2], be: c[3], fe: c[4], qa: c[5], bugs: c[6] });
}

const problems = [];
for (const f of features.values()) {
  for (const s of f.subs) if (!progress.has(s)) problems.push(`${s} is in feature-list.md but missing from feature-progress-list.md`);
  for (const d of f.deps) if (!features.has(d.slice(0, 8))) problems.push(`${f.id} depends on unknown ${d}`);
}
for (const s of progress.keys()) if (!features.has(s.slice(0, 8))) problems.push(`${s} is in feature-progress-list.md but not in feature-list.md`);

const sub = (id) => progress.get(id) ?? { name: '?', status: 'Todo', be: 'Todo', fe: 'Todo', qa: 'Todo', bugs: '—' };
const isP1 = (id) => /\(P1\)/.test(sub(id).name);
const coreSubs = (f) => (f.priority === 'P0' ? f.subs.filter((s) => !isP1(s)) : f.subs);
const subDone = (id) => sub(id).status === 'Done';
// A dependency on a feature is met when its core (P0) sub-features are Done; P1 extras never block dependents.
const depMet = (d) => (d.includes('.') ? subDone(d) : coreSubs(features.get(d) ?? { subs: [] }).every(subDone));

// ---------- dependents (who waits on whom) ----------
const directDependents = new Map([...features.keys()].map((k) => [k, new Set()]));
for (const f of features.values()) for (const d of f.deps) directDependents.get(d.slice(0, 8))?.add(f.id);

const transitive = new Map();
function dependentsOf(id, stack = new Set()) {
  if (transitive.has(id)) return transitive.get(id);
  if (stack.has(id)) { problems.push(`dependency cycle through ${id}`); return new Set(); }
  stack.add(id);
  const all = new Set();
  for (const d of directDependents.get(id) ?? []) { all.add(d); for (const x of dependentsOf(d, stack)) all.add(x); }
  stack.delete(id);
  transitive.set(id, all);
  return all;
}
for (const id of features.keys()) dependentsOf(id);

// ---------- classify ----------
function classify(f) {
  const subs = f.subs.map((id) => ({ id, ...sub(id) }));
  const core = coreSubs(f).map((id) => ({ id, ...sub(id) }));
  const unmet = f.deps.filter((d) => !depMet(d));
  const open = subs.filter((s) => s.status !== 'Done');
  const todo = open.filter((s) => s.status === 'Todo');
  const blocked = open.filter((s) => s.status === 'Blocked');
  const active = open.filter((s) => ACTIVE.includes(s.status));
  let state;
  if (open.length === 0) state = 'Done';
  else if (core.every((s) => s.status === 'Done') && active.length === 0) state = 'Core done';
  else if (active.length) state = 'In progress';
  else if (unmet.length) state = 'Waiting';
  else if (todo.length) state = 'Ready';
  else state = 'Blocked';
  return { f, subs, core, unmet, open, todo, blocked, active, state, unlocks: transitive.get(f.id).size };
}
const rows = [...features.values()].map(classify);
const byId = new Map(rows.map((r) => [r.f.id, r]));

const rank = (a, b) =>
  b.unlocks - a.unlocks ||
  (a.f.priority === b.f.priority ? 0 : a.f.priority < b.f.priority ? -1 : 1) ||
  a.f.stageIndex - b.f.stageIndex ||
  a.f.id.localeCompare(b.f.id);

// Topological build order of everything not finished, ranked within each wave.
function buildOrder() {
  const remaining = rows.filter((r) => r.state !== 'Done' && r.state !== 'Core done');
  const left = new Set(remaining.map((r) => r.f.id));
  const order = [];
  let wave = 1;
  while (left.size) {
    const ready = [...left].map((id) => byId.get(id)).filter((r) => r.f.deps.every((d) => !left.has(d.slice(0, 8)) || d.slice(0, 8) === r.f.id));
    if (!ready.length) { problems.push(`cannot order: ${[...left].join(', ')} (cycle?)`); break; }
    ready.sort(rank).forEach((r) => { order.push({ r, wave }); left.delete(r.f.id); });
    wave++;
  }
  return order;
}

// ---------- role queues ----------
const subLine = (s) => `${s.id} ${s.name}`;
const notApplicable = (v) => v === 'N/A';
const rabbiQueue = [], shamimQueue = [], tanvirQueue = [], bugTriage = [], toClose = [], inRequirements = [];
for (const r of rows) {
  for (const s of r.subs) {
    if (s.status === 'Requirements') inRequirements.push(s);
    if (s.status === 'Done' || s.status === 'Blocked' || s.status === 'Todo' || s.status === 'Requirements') continue;
    if (s.be === 'Bug' || s.fe === 'Bug' || s.qa === 'Bug') {
      if (!/BUG-\d+/.test(s.bugs)) bugTriage.push(s);
      if (s.be === 'Bug') rabbiQueue.push({ s, why: `bug fix ${s.bugs}` });
      if (s.fe === 'Bug') shamimQueue.push({ s, why: `bug fix ${s.bugs}` });
      continue;
    }
    if (s.be !== 'Done' && !notApplicable(s.be)) rabbiQueue.push({ s, why: s.be === 'In progress' ? 'in progress' : 'backend build' });
    else if (s.fe !== 'Done' && !notApplicable(s.fe)) shamimQueue.push({ s, why: s.fe === 'In progress' ? 'in progress' : 'frontend build' });
    else if (s.qa !== 'Done') tanvirQueue.push({ s, why: s.status === 'Bug fix' ? 'retest' : 'full QA' });
    else toClose.push(s);
  }
}
const ready = rows.filter((r) => r.state === 'Ready').sort(rank);
// Features held back by a feature's blocked sub-features: dependents on the blocked sub itself,
// or on the whole feature when a blocked sub is core (P0). Counted transitively.
function heldBack(r) {
  const blockedIds = new Set(r.blocked.map((s) => s.id));
  const blocksFeature = r.blocked.some((s) => !(r.f.priority === 'P0' && isP1(s.id)));
  const direct = rows.filter((o) => o.f.deps.some((d) => blockedIds.has(d) || (d === r.f.id && blocksFeature))).map((o) => o.f.id);
  const all = new Set(direct);
  for (const id of direct) for (const x of transitive.get(id)) all.add(x);
  return all.size;
}
const decisionNeeds = rows
  .filter((r) => r.blocked.length && r.state !== 'Done')
  .map((r) => ({ ...r, held: heldBack(r) }))
  .sort((a, b) => b.held - a.held || rank(a, b));

// ---------- render ----------
const today = new Date().toISOString().slice(0, 10);
const out = [];
const p = (s = '') => out.push(s);
const list = (items, fmt, empty = '_None._') => { if (!items.length) p(empty); else items.forEach((x) => p(fmt(x))); };

p('# Feature queue');
p();
p(`Generated ${today} by \`node scripts/feature-queue.mjs\` from \`feature-list.md\` and \`feature-progress-list.md\`. **Do not edit by hand** — update those files and re-run.`);
p();
p('Ranking rule: a feature that more other features depend on (directly or indirectly) goes first. Ties → P0 before P1 → earlier stage → lower ID.');
p();

const count = (st) => rows.filter((r) => r.state === st).length;
p('## Overview');
p();
p('| Done | Core done | In progress | Ready to assign | Waiting on dependencies | Blocked by decisions |');
p('|---|---|---|---|---|---|');
p(`| ${count('Done')} | ${count('Core done')} | ${count('In progress')} | ${count('Ready')} | ${count('Waiting')} | ${count('Blocked')} |`);
p();

p('## Next to assign (Minhaj)');
p();
p('Start each with a requirement review (status `Requirements`) before handing to Rabbi.');
p();
if (!ready.length) p('_Nothing ready. Finish in-progress work or resolve decisions below._');
else {
  p('| # | Feature | Priority | Unlocks | Assignable sub-features | Blocked sub-features | First owner |');
  p('|---|---|---|---|---|---|---|');
  ready.forEach((r, i) => {
    const first = r.todo.some((s) => !notApplicable(s.be)) ? 'Rabbi' : 'Shamim';
    p(`| ${i + 1} | ${r.f.id} ${r.f.name} | ${r.f.priority} | ${r.unlocks} | ${r.todo.map((s) => s.id).join(', ')} | ${r.blocked.map((s) => s.id).join(', ') || '—'} | ${first} |`);
  });
}
p();

p('## Work queues by responsibility');
p();
p('### Minhaj — project manager');
p();
p('**Requirement reviews in progress:**');
list(inRequirements, (s) => `- ${subLine(s)}`);
p();
p('**Bugs waiting for triage (no BUG ID yet):**');
list(bugTriage, (s) => `- ${subLine(s)} — ${s.bugs}`);
p();
p('**Ready to close (QA passed):**');
list(toClose, (s) => `- ${subLine(s)}`);
p();
p('**Decisions to request from the user (ranked by what they unblock):**');
if (!decisionNeeds.length) p('_None._');
else {
  p();
  p('| Decision | Feature | Blocked sub-features | Features held back |');
  p('|---|---|---|---|');
  decisionNeeds.forEach((r) => p(`| ${r.f.decisions.join(', ') || 'see feature-list.md'} | ${r.f.id} ${r.f.name} | ${r.blocked.map((s) => s.id).join(', ')} | ${r.held} |`));
}
p();
for (const [who, q] of [['Rabbi — backend', rabbiQueue], ['Shamim — frontend', shamimQueue], ['Tanvir — QA', tanvirQueue]]) {
  p(`### ${who}`);
  p();
  list(q, ({ s, why }) => `- ${subLine(s)} — ${why}`);
  p();
}

p('## In progress');
p();
list(rows.filter((r) => r.state === 'In progress').sort(rank), (r) => `- ${r.f.id} ${r.f.name} — ${r.active.map((s) => `${s.id} (${s.status})`).join(', ')}`);
p();

p('## Waiting on dependencies');
p();
const waiting = rows.filter((r) => r.state === 'Waiting').sort(rank);
if (!waiting.length) p('_None._');
else {
  p('| Feature | Unlocks | Waiting for |');
  p('|---|---|---|');
  waiting.forEach((r) => p(`| ${r.f.id} ${r.f.name} | ${r.unlocks} | ${r.unmet.join(', ')} |`));
}
p();

p('## Blocked by decisions');
p();
list(rows.filter((r) => r.state === 'Blocked').sort(rank), (r) => `- ${r.f.id} ${r.f.name} — all remaining sub-features blocked`);
p();

p('## Done');
p();
list(rows.filter((r) => r.state === 'Done' || r.state === 'Core done'), (r) => `- ${r.f.id} ${r.f.name}${r.state === 'Core done' ? ` — core done; P1 left: ${r.open.map((s) => s.id).join(', ')}` : ''}`);
p();

p('## Full build order (remaining features)');
p();
p('Wave = earliest point a feature can start (all its dependencies are in earlier waves). Features in the same wave can run in parallel.');
p();
p('| Order | Wave | Feature | Priority | Unlocks | Depends on | State |');
p('|---|---|---|---|---|---|---|');
buildOrder().forEach(({ r, wave }, i) => p(`| ${i + 1} | ${wave} | ${r.f.id} ${r.f.name} | ${r.f.priority} | ${r.unlocks} | ${r.f.deps.join(', ') || '—'} | ${r.state} |`));
p();

if (problems.length) {
  p('## Data problems');
  p();
  [...new Set(problems)].forEach((x) => p(`- ${x}`));
  p();
}

// ---------- refresh Summary table in feature-progress-list.md ----------
function refreshProgressSummary() {
  const stages = [...new Set(rows.map((r) => r.f.stage))];
  const stat = (rs, pred) => rs.flatMap((r) => r.subs).filter(pred).length;
  const lines = ['| Stage | Features | Sub-features | Done | In progress | Blocked |', '|---|---|---|---|---|---|'];
  const tot = [0, 0, 0, 0, 0];
  for (const st of stages) {
    const rs = rows.filter((r) => r.f.stage === st);
    const v = [rs.length, stat(rs, () => true), stat(rs, (s) => s.status === 'Done'), stat(rs, (s) => ACTIVE.includes(s.status)), stat(rs, (s) => s.status === 'Blocked')];
    v.forEach((x, i) => (tot[i] += x));
    lines.push(`| ${st} | ${v.join(' | ')} |`);
  }
  lines.push(`| **Total** | ${tot.map((x) => `**${x}**`).join(' | ')} |`);
  const src = readFileSync(progressPath, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const updated = src.replace(/(## Summary\r?\n\r?\n)(?:\|.*\r?\n)+/, `$1${lines.join(eol)}${eol}`);
  if (updated !== src) writeFileSync(progressPath, updated);
}

const md = out.join('\n');
if (process.argv.includes('--stdout')) process.stdout.write(md);
else {
  refreshProgressSummary();
  writeFileSync(outPath, md);
  console.log(`Wrote ${outPath}`);
  console.log(`Ready: ${ready.map((r) => r.f.id).join(', ') || 'none'}${problems.length ? ` | ${problems.length} data problem(s)` : ''}`);
}
