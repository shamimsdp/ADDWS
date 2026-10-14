import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import http from 'node:http';
import { hookEvent } from './claude-hook.mjs';
import {
  currentWork,
  findContextRoot,
  readLedger,
  timeSummary,
  parseProject,
  parseWbs,
  readEvents,
  report,
  runtime,
  safeText,
  STALE_MS,
  workflowStatus,
} from './store.mjs';
import { createDashboard } from './server.mjs';

const at = new Date('2026-10-12T09:00:00Z');
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ims-agent-dashboard-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('parallel sessions retain active work when another session completes', async (t) => {
  const directory = await fixture(t);
  await report(
    directory,
    { agent: 'rabbi', source: 'codex', sessionId: 'one', status: 'active', task: 'Build API' },
    at,
  );
  await report(
    directory,
    { agent: 'rabbi', source: 'claude', sessionId: 'two', status: 'completed' },
    new Date(at.getTime() + 1000),
  );
  const agent = runtime(await readEvents(directory), at.getTime() + 2000).find(
    (a) => a.id === 'rabbi',
  );
  assert.equal(agent.status, 'active');
  assert.equal(agent.sessions.length, 2);
  assert.equal(agent.current.task, 'Build API');
});

test('no heartbeat becomes stale; fresh heartbeat preserves task and recovers activity', async (t) => {
  const directory = await fixture(t);
  await report(
    directory,
    { agent: 'shamim', sessionId: 'one', status: 'active', task: 'Build UI' },
    at,
  );
  assert.equal(
    runtime(await readEvents(directory), at.getTime() + STALE_MS + 1)[2].status,
    'stale',
  );
  await report(
    directory,
    { agent: 'shamim', sessionId: 'one', status: 'active', kind: 'heartbeat' },
    new Date(at.getTime() + STALE_MS),
  );
  const agent = runtime(await readEvents(directory), at.getTime() + STALE_MS + 1)[2];
  assert.equal(agent.status, 'active');
  assert.equal(agent.current.task, 'Build UI');
  assert.equal(agent.current.startedAt, at.toISOString());
});

test('concurrent writers use independent files without lost events', async (t) => {
  const directory = await fixture(t);
  await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      report(
        directory,
        { agent: 'tanvir', source: 'codex', sessionId: `session-${i}`, status: 'active' },
        at,
      ),
    ),
  );
  const events = await readEvents(directory);
  assert.equal(events.length, 30);
  assert.equal(new Set(events.map((e) => e.id)).size, 30);
});

test('hook records only safe metadata and rejects unrelated subagents', () => {
  const input = {
    hook_event_name: 'PreToolUse',
    session_id: 'one',
    agent_id: 'two',
    agent_type: 'rabbi-backend-developer',
    tool_name: 'Bash',
    tool_input: { command: 'secret command' },
    prompt: 'private prompt',
    transcript_path: '/private/transcript',
  };
  const event = hookEvent(input);
  assert.equal(event.agent, 'rabbi');
  assert.equal(event.action, 'Using Bash');
  assert.doesNotMatch(JSON.stringify(event), /secret command|private prompt|transcript/);
  assert.equal(hookEvent({ ...input, agent_type: 'Explore' }), null);
  // The main session (no agent type, no agent id) is the coordinator, never a team member.
  const main = hookEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'one' });
  assert.equal(main.agent, 'main');
  assert.ok(runtime([{ ...main, at: new Date().toISOString() }]).every((a) => a.status === 'idle'));
  assert.equal(hookEvent({ ...input, agent_type: 'nadia-cr-manager' }).agent, 'nadia');
  assert.equal(hookEvent({ ...input, hook_event_name: 'SubagentStop' }).status, 'completed');
  assert.equal(hookEvent({ ...input, hook_event_name: 'PermissionRequest' }).status, 'waiting');
});

test('invalid identities/statuses rejected and accidental connection strings redacted', async (t) => {
  const directory = await fixture(t);
  await assert.rejects(() =>
    report(directory, { agent: '../escape', sessionId: 'one', status: 'active' }),
  );
  await assert.rejects(() =>
    report(directory, { agent: 'rabbi', sessionId: '../escape?', status: 'active' }),
  );
  await assert.rejects(() =>
    report(directory, { agent: 'rabbi', sessionId: 'one', status: 'invented' }),
  );
  const event = await report(directory, {
    agent: 'rabbi',
    sessionId: 'one',
    status: 'active',
    task: 'postgresql://user:password@private/db token=private-token',
    toolOutput: 'private output',
  });
  assert.doesNotMatch(JSON.stringify(event), /private|toolOutput/);
  assert.equal(safeText('apiKey=abc'), 'apiKey=[redacted]');
});

test('assignment rows and queue never synthesize active runtime', () => {
  const project = parseProject(
    '| FEAT-046.1 | Telemetry | Backend | In progress | N/A | Todo | — | Today |',
    '| FEAT-046 | Dashboard | Backend | Rabbi | x.md |',
    '## Next to assign\n| 1 | FEAT-002 Authentication | P0 | 39 | IDs | — | Rabbi |\n## Work queues',
  );
  assert.equal(project.totals.inProgress, 1);
  assert.equal(project.assignments[0].agent, 'rabbi');
  assert.equal(project.next[0].id, 'FEAT-002');
  assert.ok(runtime([]).every((agent) => agent.status === 'idle'));
});

test('loopback read-only server refuses hostile origins/hosts and filesystem requests', async (t) => {
  const directory = await fixture(t);
  const dashboard = createDashboard({ directory });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const url = `http://127.0.0.1:${dashboard.server.address().port}`;
  assert.equal((await fetch(`${url}/api/snapshot`)).status, 200);
  assert.equal(
    (await fetch(`${url}/api/snapshot`, { headers: { Origin: 'https://evil.example' } })).status,
    403,
  );
  const hostileHostStatus = await new Promise((resolve, reject) => {
    http
      .get(`${url}/api/snapshot`, { headers: { Host: 'evil.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
      .on('error', reject);
  });
  assert.equal(hostileHostStatus, 403);
  assert.equal((await fetch(`${url}/api/snapshot`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/.env`)).status, 404);
  assert.equal((await fetch(`${url}/context/progress-tracker.md`)).status, 404);
});

test('SSE publishes newly reported activity and omits heartbeat noise', async (t) => {
  const directory = await fixture(t);
  const dashboard = createDashboard({ directory });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`http://127.0.0.1:${dashboard.server.address().port}/api/events`, {
    signal: controller.signal,
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  await reader.read(); // initial snapshot
  await report(directory, {
    agent: 'tanvir',
    sessionId: 'qa',
    status: 'active',
    task: 'Verify live updates',
  });
  const next = await reader.read();
  assert.match(decoder.decode(next.value), /Verify live updates/);
  await reader.cancel();
});

test('corrupt event files are skipped instead of breaking the dashboard', async (t) => {
  const directory = await fixture(t);
  await report(directory, { agent: 'minhaj', sessionId: 'one', status: 'idle' });
  await writeFile(path.join(directory, 'events', '1000-abcdef.json'), '{broken');
  assert.equal((await readEvents(directory)).length, 1);
});

test('stored extra fields and accidental credentials are never served as activity data', async (t) => {
  const directory = await fixture(t);
  const event = await report(directory, { agent: 'minhaj', sessionId: 'one', status: 'idle' });
  await writeFile(
    path.join(directory, 'events', '9999999999999-abcdef.json'),
    JSON.stringify({
      ...event,
      prompt: 'private prompt',
      toolInput: 'private input',
      task: 'token=private-token',
    }),
  );
  const serialized = JSON.stringify(await readEvents(directory));
  assert.doesNotMatch(serialized, /private prompt|private input|private-token|toolInput/);
});

const wbsProgress = [
  '## Summary',
  '| Stage | Features |',
  '## Stage 1 — Foundation',
  '### FEAT-003 Roles and permissions — P0',
  '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | PM verify (h) | BE agent (h) | BE verify (h) | FE agent (h) | FE verify (h) | QA agent (h) | QA verify (h) | Updated |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| FEAT-003.1 | Predefined roles | Backend | Review | Todo | Todo | — | 0.5 | 0.5 | 2.25 | 0.75 | 2.25 | 0.75 | 1.5 | 0.5 | Today |',
  '| FEAT-003.2 | Guards token=abc123 | Todo | Todo | N/A | Todo | — | 0.5 | 0.5 | 2.25 | 0.75 | — | — | 1.25 | 0.5 | — |',
  '## Change log',
  '| FEAT-999.1 | Not a sub-feature row | Done | Done | Done | Done | — | — |',
].join('\n');

test('WBS parses stages, features, layer status and estimates by header name', () => {
  const wbs = parseWbs(wbsProgress, '{"mode":"agent-human-review"}');
  assert.equal(wbs.mode, 'agent-human-review');
  assert.equal(wbs.estimateColumns.length, 8);
  assert.equal(wbs.stages.length, 1);
  const [feature] = wbs.stages[0].features;
  assert.deepEqual(
    [feature.id, feature.name, feature.priority],
    ['FEAT-003', 'Roles and permissions', 'P0'],
  );
  assert.equal(feature.subs.length, 2);
  assert.equal(feature.subs[0].be, 'Review');
  assert.equal(feature.subs[0].estimates['BE verify (h)'], 0.75);
  assert.equal(feature.subs[1].estimates['FE agent (h)'], null);
  assert.ok(!feature.subs[1].name.includes('abc123'));
  assert.equal(parseWbs(wbsProgress, 'not json').mode, 'agent-human-review');
});

test('WBS page and API are served read-only from the progress list', async (t) => {
  const directory = await fixture(t);
  await mkdir(path.join(directory, 'context'));
  await writeFile(path.join(directory, 'context/feature-progress-list.md'), wbsProgress);
  await writeFile(path.join(directory, 'context/delivery-config.json'), '{"mode":"fully-agentic"}');
  const dashboard = createDashboard({ root: directory, directory });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const url = `http://127.0.0.1:${dashboard.server.address().port}`;
  const api = await (await fetch(`${url}/api/wbs`)).json();
  assert.equal(api.mode, 'fully-agentic');
  assert.equal(api.stages[0].features[0].subs[0].id, 'FEAT-003.1');
  const page = await fetch(`${url}/wbs`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Work breakdown/);
  assert.equal((await fetch(`${url}/api/wbs`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/context/delivery-config.json`)).status, 404);
});

test('real agent photos are advertised and served only for known agents and image types', async (t) => {
  const directory = await fixture(t);
  const avatars = path.join(directory, 'avatars');
  await mkdir(avatars);
  const dashboard = createDashboard({ directory, avatars });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const url = `http://127.0.0.1:${dashboard.server.address().port}`;
  await writeFile(path.join(avatars, 'rabbi.webp'), 'webp-bytes');
  await writeFile(path.join(avatars, 'intruder.png'), 'png-bytes');
  const snapshot = await (await fetch(`${url}/api/snapshot`)).json();
  assert.deepEqual(snapshot.photos, { rabbi: 'webp' });
  const served = await fetch(`${url}/avatars/rabbi.webp`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.equal(await served.text(), 'webp-bytes');
  assert.equal((await fetch(`${url}/avatars/rabbi.png`)).status, 404);
  assert.equal((await fetch(`${url}/avatars/intruder.png`)).status, 404);
  assert.equal((await fetch(`${url}/avatars/shamim.jpg`)).status, 404);
});

test('workflow status separates named agents, main session only and idle', async (t) => {
  const directory = await fixture(t);
  const sample = { source: 'claude', status: 'active' };
  assert.equal(workflowStatus(await readEvents(directory)).state, 'idle');
  await report(directory, { ...sample, agent: 'main', sessionId: 'm/main', action: 'Using Bash' });
  const mainOnly = workflowStatus(await readEvents(directory));
  assert.equal(mainOnly.state, 'main');
  assert.deepEqual(mainOnly.agents, []);
  await report(directory, { ...sample, agent: 'rabbi', sessionId: 'm/r' });
  await report(directory, { ...sample, status: 'waiting', agent: 'tanvir', sessionId: 'm/t' });
  const running = workflowStatus(await readEvents(directory));
  assert.equal(running.state, 'agents');
  assert.deepEqual(running.agents.map((a) => a.name).sort(), ['Rabbi', 'Tanvir']);
  // The coordinator never becomes a team card.
  assert.ok(runtime(await readEvents(directory)).every((a) => a.id !== 'main'));
  // Stale sessions stop counting as running work.
  assert.equal(
    workflowStatus(await readEvents(directory), Date.now() + STALE_MS * 2).state,
    'idle',
  );
});

const layeredProgress = [
  '## Stage 1 — Foundation',
  '### FEAT-003 Roles and permissions — P0',
  '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| FEAT-003.1 | Predefined roles | QA | Done | Done | In progress | — | 0.5 | 2.25 | 2.25 | 1.5 | — |',
  '### FEAT-027 Cash shifts and register — P0',
  '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| FEAT-027.1 | Register setup | Backend | In progress | Todo | Todo | — | 1 | 2.5 | 2 | 1.5 | — |',
  '| FEAT-027.2 | Open shift | Backend | In progress | Todo | Todo | — | 0.5 | 4 | 3 | 2.5 | — |',
  '| FEAT-027.3 | Close shift | Todo | Todo | Todo | Todo | — | 0.5 | 3 | 2.5 | 2 | — |',
].join('\n');

test('current work per role comes from the tracker, with progress', () => {
  const work = currentWork(parseWbs(layeredProgress));
  assert.equal(work.rabbi.feature, 'FEAT-027');
  assert.deepEqual(work.rabbi.subs, ['FEAT-027.1', 'FEAT-027.2']);
  assert.equal(work.rabbi.layer, 'BE');
  assert.equal(work.rabbi.percent, 0);
  assert.equal(work.rabbi.layerTotal, 3);
  // QA is in progress on FEAT-003, which has two of its three layers done.
  assert.equal(work.tanvir.feature, 'FEAT-003');
  assert.equal(work.tanvir.percent, 67);
  assert.equal(work.shamim, undefined);
});

test('working time counts only gaps after an active event and splits across sub-features', async (t) => {
  const directory = await fixture(t);
  const base = new Date('2026-10-14T10:00:00Z').getTime();
  const send = (seconds, status) =>
    report(
      directory,
      {
        agent: 'rabbi',
        source: 'claude',
        sessionId: 'run-1',
        status,
        feature: 'FEAT-027',
        subs: ['FEAT-027.1', 'FEAT-027.2'],
      },
      new Date(base + seconds * 1000),
    );
  await send(0, 'active');
  await send(60, 'active'); // +60 s
  await send(120, 'waiting'); // +60 s, then waiting is not work
  await send(400, 'active'); // 280 s while waiting: not counted
  await send(430, 'completed'); // +30 s, run ends
  await send(1400, 'active'); // a second run starts
  await send(2200, 'active'); // 800 s is over the gap limit: dropped
  const { agents, actual } = timeSummary(await readLedger(directory), base + 2300 * 1000);
  assert.equal(agents.rabbi.runs, 2);
  assert.equal(agents.rabbi.last.activeMs, 150_000);
  assert.equal(agents.rabbi.current.activeMs, 100_000); // only the live tail since the last event
  assert.equal(actual['FEAT-027.1'].BE, 75_000);
  assert.equal(actual['FEAT-027.2'].BE, 75_000);
  // The main session is never given a card or a ledger entry.
  await report(directory, { agent: 'main', source: 'claude', sessionId: 'm', status: 'active' });
  assert.equal(timeSummary(await readLedger(directory)).agents.main, undefined);
});

test('events derive their feature from the tracker found above the working directory', async (t) => {
  const directory = await fixture(t);
  const workspace = path.join(directory, 'worktree');
  await mkdir(path.join(workspace, 'context'), { recursive: true });
  await mkdir(path.join(workspace, 'apps', 'web'), { recursive: true });
  await writeFile(path.join(workspace, 'context/feature-progress-list.md'), layeredProgress);
  assert.equal(findContextRoot(path.join(workspace, 'apps', 'web'), 'fallback'), workspace);
  assert.equal(findContextRoot(path.join(directory, 'nowhere'), 'fallback'), 'fallback');
  const event = await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'derive',
    status: 'active',
    contextRoot: workspace,
  });
  assert.equal(event.feature, 'FEAT-027');
  assert.deepEqual(event.subs, ['FEAT-027.1', 'FEAT-027.2']);
});

test('WBS API and stream report live work and actual hours', async (t) => {
  const directory = await fixture(t);
  await mkdir(path.join(directory, 'context'));
  await writeFile(path.join(directory, 'context/feature-progress-list.md'), layeredProgress);
  const now = Date.now();
  for (const minutes of [10, 5, 0])
    await report(
      directory,
      {
        agent: 'rabbi',
        source: 'claude',
        sessionId: 'live',
        status: 'active',
        contextRoot: directory,
      },
      new Date(now - minutes * 60_000),
    );
  const dashboard = createDashboard({ root: directory, directory });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const url = `http://127.0.0.1:${dashboard.server.address().port}`;
  const api = await (await fetch(`${url}/api/wbs`)).json();
  assert.equal(api.live[0].agent, 'rabbi');
  assert.equal(api.live[0].feature, 'FEAT-027');
  assert.deepEqual(api.live[0].subs, ['FEAT-027.1', 'FEAT-027.2']);
  assert.equal(api.actual['FEAT-027.1'].BE, 0.083); // 10 min over two sub-features
  const stream = await fetch(`${url}/api/wbs-events`);
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  const reader = stream.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  await reader.cancel();
  const pushed = JSON.parse(first.replace(/^data: /, ''));
  assert.equal(pushed.live[0].name, 'Rabbi');
  const snapshot = await (await fetch(`${url}/api/snapshot`)).json();
  assert.equal(snapshot.work.rabbi.feature, 'FEAT-027');
  assert.equal(snapshot.time.agents.rabbi.runs, 1);
});

test('funny working labels are stable per agent and rotate over time', async () => {
  const { funnyWorking } = await import('./public/activity.js');
  const now = Date.UTC(2026, 9, 14, 10, 0, 0);
  assert.equal(funnyWorking('rabbi', now), funnyWorking('rabbi', now + 1000));
  const seen = new Set(
    Array.from({ length: 12 }, (_, i) => funnyWorking('rabbi', now + i * 45_000)),
  );
  assert.ok(seen.size > 6);
  assert.ok([...seen].every((text) => text.endsWith('…') && !/unspecified/i.test(text)));
});
