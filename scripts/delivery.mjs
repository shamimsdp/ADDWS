// Shared delivery-mode rules for context/feature-progress-list.md.
// Mode lives in context/delivery-config.json:
//   agent-human-review — agents build, a human reviews/verifies each layer (agent + verify estimates)
//   fully-agentic      — agents build and verify (agent estimates only)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const configPath = join(root, 'context', 'delivery-config.json');
export const MODES = ['agent-human-review', 'fully-agentic'];

export function readConfig(path = configPath) {
  let config = {};
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // Missing or unreadable config falls back to the safer human-review mode.
  }
  const mode = MODES.includes(config.mode) ? config.mode : 'agent-human-review';
  return { ...config, mode, estimateUnit: 'hours' };
}

export const BASE_COLUMNS = [
  'ID',
  'Sub-feature',
  'Status',
  'BE (Rabbi)',
  'FE (Shamim)',
  'QA (Tanvir)',
  'Bugs',
];
export const LAYERS = [
  { key: 'pm', label: 'PM' },
  { key: 'be', label: 'BE' },
  { key: 'fe', label: 'FE' },
  { key: 'qa', label: 'QA' },
];
export const agentColumn = (layer) => `${layer.label} agent (h)`;
export const verifyColumn = (layer) => `${layer.label} verify (h)`;

export function estimateColumns(mode) {
  return LAYERS.flatMap((l) =>
    mode === 'fully-agentic' ? [agentColumn(l)] : [agentColumn(l), verifyColumn(l)],
  );
}
export const columnsFor = (mode) => [...BASE_COLUMNS, ...estimateColumns(mode), 'Updated'];
export const isHumanColumn = (name) => / verify \(h\)$/.test(name);
export const isAgentColumn = (name) => / agent \(h\)$/.test(name);

// Baseline effort in hours. Minhaj refines it during requirement review.
// High-risk (Deep lane) areas take 1.5x: auth, access, tenancy, migrations, money, stock posting, concurrency.
const DEEP =
  /auth|session|password|permission|role|tenant|isolation|scop|migrat|payment|tender|refund|settlement|cash|tax|stock|ledger|posting|reserv|transfer|count|adjust|return|exchange|offline|sync|concurren|webhook|reconcil/i;
const BASE = {
  pm: { agent: 0.25, verify: 0.25 },
  be: { agent: 1.5, verify: 0.5 },
  fe: { agent: 1.5, verify: 0.5 },
  qa: { agent: 0.75, verify: 0.25 },
};
const quarter = (x) => Math.round(x * 4) / 4;
export const formatHours = (x) => (x === null ? '—' : String(quarter(x)));

export function baselineEstimate({ featureName = '', subName = '', be = 'Todo', fe = 'Todo' }) {
  const factor = DEEP.test(`${featureName} ${subName}`) ? 1.5 : 1;
  const both = be !== 'N/A' && fe !== 'N/A';
  const active = { pm: true, be: be !== 'N/A', fe: fe !== 'N/A', qa: true };
  const out = {};
  for (const l of LAYERS) {
    const base = BASE[l.key];
    const extra = l.key === 'qa' && both ? 0.25 : 0;
    out[agentColumn(l)] = active[l.key] ? quarter((base.agent + extra) * factor) : null;
    out[verifyColumn(l)] = active[l.key] ? quarter(base.verify * factor) : null;
  }
  return out;
}

export const splitRow = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
export const isHeader = (line) => /^\| ID \| Sub-feature \|/.test(line);
export const isSubRow = (line) => /^\| FEAT-\d{3}\.\d+ \|/.test(line);

// Hours value of a cell; '—', blank or non-numeric count as zero.
export const hours = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

// Rewrites every sub-feature table to the columns of `mode`.
// Existing estimate values are kept; missing ones get the baseline estimate.
export function rewriteProgress(src, mode) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const target = columnsFor(mode);
  const lines = src.split(/\r?\n/);
  let header = null;
  let featureName = '';
  const dropped = new Set();
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fh = line.match(/^### FEAT-\d{3} (.+?) — P\d\s*$/);
    if (fh) featureName = fh[1];
    if (isHeader(line)) {
      header = splitRow(line);
      for (const name of header)
        if (!target.includes(name) && /\(h\)$/.test(name)) dropped.add(name);
      out.push(`| ${target.join(' | ')} |`);
      out.push(`|${target.map(() => '---').join('|')}|`);
      if (/^\|[-| ]+\|$/.test(lines[i + 1] ?? '')) i++;
      continue;
    }
    if (header && isSubRow(line)) {
      const cells = splitRow(line);
      const byName = Object.fromEntries(header.map((name, j) => [name, cells[j] ?? '']));
      const baseline = baselineEstimate({
        featureName,
        subName: byName['Sub-feature'],
        be: byName['BE (Rabbi)'],
        fe: byName['FE (Shamim)'],
      });
      const row = target.map((name) => {
        if (byName[name] !== undefined && byName[name] !== '') return byName[name];
        if (name in baseline) return formatHours(baseline[name]);
        return '—';
      });
      out.push(`| ${row.join(' | ')} |`);
      continue;
    }
    if (!line.startsWith('|')) header = null;
    out.push(line);
  }
  return { text: out.join(eol), dropped: [...dropped] };
}
