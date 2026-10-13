import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import http from 'node:http';
import { hookEvent } from './claude-hook.mjs';
import { parseProject, readEvents, report, runtime, safeText, STALE_MS } from './store.mjs';
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
