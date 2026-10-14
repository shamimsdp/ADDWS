import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const AGENTS = [
  {
    id: 'minhaj',
    name: 'Minhaj',
    role: 'Project manager',
    specialty: 'Scope, decisions & handoffs',
    color: 'violet',
  },
  {
    id: 'rabbi',
    name: 'Rabbi',
    role: 'Backend engineer',
    specialty: 'APIs, database & business logic',
    color: 'blue',
  },
  {
    id: 'shamim',
    name: 'Shamim',
    role: 'Frontend engineer',
    specialty: 'Interfaces & interactions',
    color: 'amber',
  },
  {
    id: 'tanvir',
    name: 'Tanvir',
    role: 'QA engineer',
    specialty: 'Tests, regressions & verification',
    color: 'green',
  },
  {
    id: 'nadia',
    name: 'Nadia',
    role: 'CR manager',
    specialty: 'Change requests & client impact',
    color: 'rose',
  },
];
// The coordinating session is not a team member: it never appears as an agent card, but its
// activity tells whether work is running without any named agent being dispatched.
export const MAIN = { id: 'main', name: 'Main session', role: 'Coordinator' };
export const STATUSES = ['active', 'waiting', 'idle', 'completed', 'failed'];
export const STALE_MS = 120_000;

export function agentId(value) {
  const match = AGENTS.find(
    (agent) => typeof value === 'string' && value.toLowerCase().includes(agent.id),
  );
  return match?.id ?? null;
}

export function safeText(value, limit = 180) {
  if (typeof value !== 'string') return '';
  return (
    value
      .replace(/(?:postgres(?:ql)?:\/\/|sk-(?:proj-)?)[^\s]+/gi, '[redacted]')
      .replace(
        /\b(token|password|secret|api[_ -]?key|authorization)\s*[:=]\s*\S+/gi,
        '$1=[redacted]',
      )
      // eslint-disable-next-line no-control-regex -- intentionally strip control characters from labels
      .replace(/[\u0000-\u001f]/g, ' ')
      .slice(0, limit)
  );
}

export function dataDirectory(root) {
  if (process.env.AGENT_DASHBOARD_DATA_DIR)
    return path.resolve(process.env.AGENT_DASHBOARD_DATA_DIR);
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    return path.join(path.resolve(root, common), 'agent-dashboard');
  } catch {
    return path.join(root, '.agent-dashboard');
  }
}

export async function report(directory, input, now = new Date()) {
  const agent = input.agent === MAIN.id ? MAIN.id : agentId(input.agent);
  if (!agent || !STATUSES.includes(input.status))
    throw new Error('A known agent and valid status are required.');
  const source = ['claude', 'codex', 'manual'].includes(input.source) ? input.source : 'manual';
  const session = safeText(input.sessionId, 100);
  if (!session || !/^[a-zA-Z0-9:_./-]+$/.test(session))
    throw new Error('A stable session ID is required.');
  const work = agent === MAIN.id ? null : await workFor(agent, input);
  const event = {
    id: randomUUID(),
    at: now.toISOString(),
    agent,
    source,
    sessionId: `${source}:${session}`,
    status: input.status,
    kind: input.kind === 'heartbeat' ? 'heartbeat' : 'activity',
    task: safeText(input.task),
    action: safeText(input.action),
    feature: work?.feature ?? '',
    subs: work?.subs ?? [],
    tokens: cleanTokens(input.tokens),
    handoffTo: agentId(input.handoffTo),
    worktree: safeText(path.basename(input.cwd || ''), 80),
  };
  const folder = path.join(directory, 'events');
  await mkdir(folder, { recursive: true });
  const name = `${now.getTime()}-${event.id}.json`;
  const temporary = path.join(folder, `.${name}.tmp`);
  await writeFile(temporary, JSON.stringify(event), { flag: 'wx', mode: 0o600 });
  await rename(temporary, path.join(folder, name));
  // Working-time accounting must never block or fail reporting.
  await recordTime(directory, event).catch(() => {});
  return event;
}

export async function readEvents(directory) {
  try {
    const folder = path.join(directory, 'events');
    const files = (await readdir(folder))
      .filter((name) => /^\d+-[a-f0-9-]+\.json$/.test(name))
      .sort()
      .slice(-3000);
    const events = await Promise.all(
      files.map(async (file) => {
        try {
          return JSON.parse(await readFile(path.join(folder, file), 'utf8'));
        } catch {
          return null;
        }
      }),
    );
    return events
      .filter(
        (event) =>
          event &&
          (event.agent === MAIN.id || AGENTS.some((a) => a.id === event.agent)) &&
          STATUSES.includes(event.status) &&
          typeof event.sessionId === 'string' &&
          /^[a-zA-Z0-9:_./-]{1,120}$/.test(event.sessionId) &&
          Number.isFinite(Date.parse(event.at)),
      )
      .map((event) => ({
        id: safeText(event.id, 100),
        at: new Date(event.at).toISOString(),
        agent: event.agent,
        source: ['claude', 'codex', 'manual'].includes(event.source) ? event.source : 'manual',
        sessionId: event.sessionId,
        status: event.status,
        kind: event.kind === 'heartbeat' ? 'heartbeat' : 'activity',
        task: safeText(event.task),
        action: safeText(event.action),
        feature: /^FEAT-\d{3}(?:\.\d+)?$/.test(event.feature ?? '') ? event.feature : '',
        subs: cleanSubs(event.subs),
        tokens: cleanTokens(event.tokens),
        handoffTo: agentId(event.handoffTo),
        worktree: safeText(event.worktree, 80),
      }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function runtime(events, now = Date.now(), roster = AGENTS) {
  const sessions = new Map();
  for (const event of events) {
    const previous = sessions.get(event.sessionId);
    // A heartbeat refreshes liveness without erasing the task description.
    sessions.set(event.sessionId, {
      ...previous,
      ...event,
      task: event.task || previous?.task || '',
      feature: event.feature || previous?.feature || '',
      startedAt: previous?.startedAt ?? event.at,
    });
  }
  return roster.map((agent) => {
    const runs = [...sessions.values()]
      .filter((run) => run.agent === agent.id)
      .map((run) => ({
        ...run,
        status:
          ['active', 'waiting'].includes(run.status) && now - Date.parse(run.at) > STALE_MS
            ? 'stale'
            : run.status,
      }))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const active = runs.find((run) => run.status === 'active');
    const waiting = runs.find((run) => run.status === 'waiting');
    const stale = runs.find((run) => run.status === 'stale');
    const current = active ?? waiting ?? stale ?? runs[0];
    return {
      ...agent,
      status: current?.status ?? 'idle',
      current: current ?? null,
      sessions: runs,
      lastSeen: runs[0]?.at ?? null,
    };
  });
}

export function parseProject(progress, board, queue) {
  const rows = progress
    .split(/\r?\n/)
    .filter((line) => /^\| FEAT-\d{3}\.\d+ \|/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const totals = {
    total: rows.length,
    done: rows.filter((row) => row[2] === 'Done').length,
    blocked: rows.filter((row) => row[2] === 'Blocked').length,
    inProgress: rows.filter((row) =>
      ['Requirements', 'Backend', 'Frontend', 'QA', 'Bug fix'].includes(row[2]),
    ).length,
  };
  const assignments = board
    .split(/\r?\n/)
    .filter((line) => /^\| FEAT-\d{3} \|/.test(line))
    .map((line) => {
      const [, id, title, status, owner] = line.split('|').map((cell) => cell.trim());
      return {
        id,
        title: safeText(title),
        status: safeText(status),
        owner: safeText(owner),
        agent: agentId(owner),
      };
    });
  const nextSection = queue.split('## Next to assign')[1]?.split('## Work queues')[0] ?? '';
  const next = nextSection
    .split(/\r?\n/)
    .filter((line) => /^\| \d+ \|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const feature = cells[1]?.match(/^(FEAT-\d{3})\s+(.+)$/);
      return feature
        ? {
            id: feature[1],
            title: safeText(feature[2]),
            priority: cells[2],
            unlocks: Number(cells[3]) || 0,
          }
        : null;
    })
    .filter(Boolean);
  return { totals, assignments, next };
}

const WBS_MODES = ['agent-human-review', 'fully-agentic'];
const estimateValue = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Full work breakdown from feature-progress-list.md: stage → feature → sub-feature, with every
// status column and the per-layer hour estimates named by the table header.
export function parseWbs(progress, configText = '') {
  let mode = 'agent-human-review';
  try {
    const parsed = JSON.parse(configText || '{}').mode;
    if (WBS_MODES.includes(parsed)) mode = parsed;
  } catch {
    // Unreadable config keeps the default mode.
  }
  const stages = [];
  const estimates = [];
  let stage = null;
  let feature = null;
  let header = [];
  const cells = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
  for (const line of progress.split(/\r?\n/)) {
    const stageMatch = line.match(/^## (Stage \d+ — .+)$/);
    if (stageMatch) {
      stage = { name: safeText(stageMatch[1]), features: [] };
      stages.push(stage);
      feature = null;
      continue;
    }
    if (/^## /.test(line)) {
      stage = null;
      feature = null;
      continue;
    }
    const featureMatch = stage && line.match(/^### (FEAT-\d{3}) (.+?) — (P\d)\s*$/);
    if (featureMatch) {
      feature = {
        id: featureMatch[1],
        name: safeText(featureMatch[2]),
        priority: featureMatch[3],
        subs: [],
      };
      stage.features.push(feature);
      continue;
    }
    if (/^\| ID \| Sub-feature \|/.test(line)) {
      header = cells(line);
      for (const name of header)
        if (/ (agent|verify) \(h\)$/.test(name) && !estimates.includes(name)) estimates.push(name);
      continue;
    }
    if (!feature || !/^\| FEAT-\d{3}\.\d+ \|/.test(line)) continue;
    const row = cells(line);
    const value = (name) => row[header.indexOf(name)] ?? '';
    feature.subs.push({
      id: row[0],
      name: safeText(value('Sub-feature')),
      status: safeText(value('Status'), 40),
      be: safeText(value('BE (Rabbi)'), 40),
      fe: safeText(value('FE (Shamim)'), 40),
      qa: safeText(value('QA (Tanvir)'), 40),
      bugs: safeText(value('Bugs')),
      updated: safeText(value('Updated'), 60),
      estimates: Object.fromEntries(
        header
          .filter((name) => / (agent|verify) \(h\)$/.test(name))
          .map((name) => [name, estimateValue(value(name))]),
      ),
    });
  }
  return { mode, estimateColumns: estimates, stages: stages.filter((s) => s.features.length) };
}

// Whether the agentic workflow is running: named agents working, the main session alone, or nothing.
export function workflowStatus(events, now = Date.now()) {
  const agents = runtime(events, now).filter((agent) =>
    ['active', 'waiting'].includes(agent.status),
  );
  const [main] = runtime(events, now, [MAIN]);
  const state = agents.length
    ? 'agents'
    : ['active', 'waiting'].includes(main.status)
      ? 'main'
      : 'idle';
  return {
    state,
    agents: agents.map((agent) => ({ id: agent.id, name: agent.name, status: agent.status })),
    main: { status: main.status, action: main.current?.action ?? '', lastSeen: main.lastSeen },
  };
}

// ---------- Current work and working time ----------

export const LAYER = { minhaj: 'PM', rabbi: 'BE', shamim: 'FE', tanvir: 'QA' };
// A tool can run for minutes without any event, so gaps up to this length still count as work.
export const MAX_GAP_MS = 600_000;
const SUB_ID = /^FEAT-\d{3}\.\d+$/;
const FEATURE_ID = /^FEAT-\d{3}$/;
const cleanTokens = (value) => {
  const count = (n) => (Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 1e11) : 0);
  return value && typeof value === 'object' && (value.input || value.output)
    ? { input: count(value.input), output: count(value.output) }
    : null;
};
const cleanSubs = (value) =>
  Array.isArray(value) ? value.filter((id) => SUB_ID.test(id ?? '')).slice(0, 12) : [];

function layerState(sub, layer) {
  if (layer === 'BE') return sub.be;
  if (layer === 'FE') return sub.fe;
  if (layer === 'QA') return sub.qa;
  return sub.status === 'Requirements' ? 'In progress' : sub.status === 'Todo' ? 'Todo' : 'Done';
}

// Which feature and sub-features each role is working on, read from the tracker: the first
// feature that has a sub-feature whose layer for that role is In progress (PM: in Requirements).
export function currentWork(wbs) {
  const features = wbs.stages.flatMap((stage) => stage.features);
  const out = {};
  for (const [agent, layer] of Object.entries(LAYER)) {
    const feature = features.find((f) =>
      f.subs.some((s) => layerState(s, layer) === 'In progress'),
    );
    if (!feature) continue;
    const cells = feature.subs
      .flatMap((s) => ['BE', 'FE', 'QA'].map((l) => layerState(s, l)))
      .filter((value) => value !== 'N/A');
    const mine = feature.subs.map((s) => layerState(s, layer)).filter((value) => value !== 'N/A');
    const done = cells.filter((value) => value === 'Done').length;
    out[agent] = {
      feature: feature.id,
      name: feature.name,
      layer,
      subs: feature.subs.filter((s) => layerState(s, layer) === 'In progress').map((s) => s.id),
      percent: cells.length ? Math.round((done / cells.length) * 100) : 0,
      done,
      total: cells.length,
      layerDone: mine.filter((value) => value === 'Done').length,
      layerTotal: mine.length,
    };
  }
  return out;
}

async function workFor(agent, input) {
  if (FEATURE_ID.test(input.feature ?? '') || SUB_ID.test(input.feature ?? ''))
    return { feature: input.feature.slice(0, 8), subs: cleanSubs(input.subs) };
  if (!input.contextRoot) return null;
  try {
    const progress = await readFile(
      path.join(input.contextRoot, 'context', 'feature-progress-list.md'),
      'utf8',
    );
    const work = currentWork(parseWbs(progress))[agent];
    return work ? { feature: work.feature, subs: work.subs } : null;
  } catch {
    return null;
  }
}

const ledgerFile = (directory, sessionId) =>
  path.join(
    directory,
    'durations',
    `${createHash('sha1').update(sessionId).digest('hex').slice(0, 24)}.json`,
  );
const ENDED = ['completed', 'failed', 'idle'];

// One small file per session, so concurrent agents never write the same file. Time between two
// events counts as work only when the earlier event left the session active.
export async function recordTime(directory, event) {
  const file = ledgerFile(directory, event.sessionId);
  let record;
  try {
    record = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    record = null;
  }
  const at = Date.parse(event.at);
  record ??= {
    sessionId: event.sessionId,
    agent: event.agent,
    lastAt: at,
    lastStatus: 'idle',
    runs: [],
    bySub: {},
    byFeature: {},
  };
  const gap = at - record.lastAt;
  let run = record.runs.at(-1);
  if ((!run || run.end) && ['active', 'waiting'].includes(event.status)) {
    run = { start: event.at, end: null, activeMs: 0, feature: event.feature, subs: event.subs };
    record.runs.push(run);
  }
  if (run && record.lastStatus === 'active' && gap > 0 && gap <= MAX_GAP_MS) {
    run.activeMs += gap;
    for (const id of event.subs)
      record.bySub[id] = (record.bySub[id] ?? 0) + gap / event.subs.length;
    if (event.feature)
      record.byFeature[event.feature] = (record.byFeature[event.feature] ?? 0) + gap;
  }
  if (run && !run.end) {
    if (event.feature) {
      run.feature = event.feature;
      run.subs = event.subs;
    }
    if (event.tokens) run.tokens = event.tokens;
    if (ENDED.includes(event.status)) run.end = event.at;
  }
  record.lastAt = at;
  record.lastStatus = event.status;
  record.runs = record.runs.slice(-20);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
  await rename(temporary, file);
}

export async function readLedger(directory) {
  try {
    const folder = path.join(directory, 'durations');
    const files = (await readdir(folder)).filter((name) => /^[a-f0-9]{24}\.json$/.test(name));
    const records = await Promise.all(
      files.map(async (file) => {
        try {
          return JSON.parse(await readFile(path.join(folder, file), 'utf8'));
        } catch {
          return null;
        }
      }),
    );
    return records.filter(
      (record) => record && typeof record.agent === 'string' && Array.isArray(record.runs),
    );
  } catch {
    return [];
  }
}

// Per-agent run times plus actual hours per sub-feature and layer, for the dashboard and WBS.
export function timeSummary(records, now = Date.now()) {
  const agents = {};
  const actual = {};
  for (const record of records) {
    if (!Object.hasOwn(LAYER, record.agent)) continue;
    const summary = (agents[record.agent] ??= {
      totalMs: 0,
      totalWallMs: 0,
      runs: 0,
      current: null,
      last: null,
      tokens: { input: 0, output: 0 },
      runList: [],
    });
    const live =
      record.lastStatus === 'active' && now - record.lastAt <= MAX_GAP_MS ? now - record.lastAt : 0;
    for (const run of record.runs) {
      summary.runs += 1;
      const open = !run.end && run === record.runs.at(-1);
      const ms = run.activeMs + (open ? live : 0);
      summary.totalMs += ms;
      const wallMs = Math.max(0, (run.end ? Date.parse(run.end) : now) - Date.parse(run.start));
      summary.totalWallMs += wallMs;
      summary.tokens.input += run.tokens?.input ?? 0;
      summary.tokens.output += run.tokens?.output ?? 0;
      const item = {
        start: run.start,
        end: run.end,
        activeMs: ms,
        wallMs,
        tokens: run.tokens ?? null,
        feature: run.feature ?? '',
        subs: run.subs ?? [],
      };
      summary.runList.push(item);
      if (open && ['active', 'waiting'].includes(record.lastStatus)) {
        if (!summary.current || Date.parse(item.start) > Date.parse(summary.current.start))
          summary.current = { ...item, asOf: new Date(now).toISOString() };
      } else if (
        !summary.last ||
        Date.parse(item.end ?? item.start) > Date.parse(summary.last.end ?? summary.last.start)
      ) {
        summary.last = item;
      }
    }
    for (const [id, ms] of Object.entries(record.bySub)) {
      if (!SUB_ID.test(id)) continue;
      const layer = LAYER[record.agent];
      actual[id] ??= {};
      actual[id][layer] = (actual[id][layer] ?? 0) + ms;
    }
  }
  for (const summary of Object.values(agents)) {
    summary.recent = summary.runList
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
      .slice(0, 8);
    delete summary.runList;
  }
  return { agents, actual };
}

// Agents in a git worktree keep their own copy of the tracker, so look upward from where they work.
export function findContextRoot(start, fallback) {
  let folder = typeof start === 'string' && start ? path.resolve(start) : '';
  for (let depth = 0; folder && depth < 8; depth++) {
    if (existsSync(path.join(folder, 'context', 'feature-progress-list.md'))) return folder;
    const parent = path.dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  return fallback;
}

// Token totals for one agent run, from its transcript: numbers only, no content is kept.
export async function transcriptTokens(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 60_000_000) return null;
  const byMessage = new Map();
  let anonymous = 0;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.includes('"usage"')) continue;
    try {
      const message = JSON.parse(line)?.message;
      const usage = message?.usage;
      if (!usage) continue;
      const id = message.id ?? `anonymous-${anonymous++}`;
      const output = usage.output_tokens || 0;
      // A message can be logged once per content block with the same usage: keep the largest.
      if (!byMessage.has(id) || output >= byMessage.get(id).output)
        byMessage.set(id, {
          input: (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
          output,
        });
    } catch {
      // Skip a line that is not JSON.
    }
  }
  const total = { input: 0, output: 0 };
  for (const usage of byMessage.values()) {
    total.input += usage.input;
    total.output += usage.output;
  }
  return total.input || total.output ? total : null;
}
