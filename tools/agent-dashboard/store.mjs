import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
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
    feature: /^FEAT-\d{3}(?:\.\d+)?$/.test(input.feature ?? '') ? input.feature : '',
    handoffTo: agentId(input.handoffTo),
    worktree: safeText(path.basename(input.cwd || ''), 80),
  };
  const folder = path.join(directory, 'events');
  await mkdir(folder, { recursive: true });
  const name = `${now.getTime()}-${event.id}.json`;
  const temporary = path.join(folder, `.${name}.tmp`);
  await writeFile(temporary, JSON.stringify(event), { flag: 'wx', mode: 0o600 });
  await rename(temporary, path.join(folder, name));
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
