import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { startCodexCollector } from './codex-collector.mjs';
import { readEvents, runtime } from './store.mjs';

const epoch = '2026-10-12T10:00:00.000Z';
const entry = (type, payload, timestamp = epoch) =>
  JSON.stringify({ type, payload, timestamp }) + '\n';
const lifecycle = (type, timestamp) => entry('event_msg', { type }, timestamp);
function meta(root, id = 'root-session', agentPath) {
  return entry('session_meta', {
    id,
    session_id: 'shared-root-session',
    cwd: root,
    source: agentPath ? { subagent: { thread_spawn: { agent_path: agentPath } } } : 'vscode',
    base_instructions: 'private initial instructions',
  });
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ims-codex-collector-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, 'sessions');
  await mkdir(sessionsRoot);
  const directory = path.join(root, 'events-data');
  const filename = path.join(sessionsRoot, 'rollout-test.jsonl');
  return { root, sessionsRoot, directory, filename };
}
async function collector(t, fixture) {
  const watcher = startCodexCollector({ ...fixture, intervalMs: 60_000 });
  t.after(() => watcher.close());
  await watcher.poll();
  return watcher;
}

test('startup reconstructs historical completion without making it fresh; polls do not replay', async (t) => {
  const f = await fixture(t);
  await writeFile(
    f.filename,
    meta(f.root) + lifecycle('task_started') + lifecycle('task_complete'),
  );
  const watcher = await collector(t, f);
  await watcher.poll();
  const events = await readEvents(f.directory);
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'completed');
  assert.equal(events[0].at, epoch);
  assert.equal(watcher.status().count, 1);
  assert.equal(watcher.status().sessions, 1);
  assert.equal(watcher.status().available, true);
});

test('appended byte size detects activity with frozen mtime and partial JSON lines', async (t) => {
  const f = await fixture(t);
  await writeFile(f.filename, meta(f.root));
  const watcher = await collector(t, f);
  const thinking = entry('response_item', { type: 'reasoning', summary: 'sensitive thoughts' });
  await appendFile(f.filename, thinking.slice(0, 27));
  await utimes(f.filename, new Date(0), new Date(0));
  await watcher.poll();
  assert.equal((await readEvents(f.directory)).length, 0);
  await appendFile(f.filename, thinking.slice(27));
  await utimes(f.filename, new Date(0), new Date(0));
  await watcher.poll();
  const events = await readEvents(f.directory);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'Thinking');
  assert.equal(events[0].status, 'active');
  assert.equal(runtime(events, Date.parse(epoch) + 121_000)[0].status, 'stale');
  assert.ok(!JSON.stringify(events).includes('sensitive'));
});

test('project and known role boundaries exclude foreign roots and unknown subagents', async (t) => {
  const f = await fixture(t);
  for (const [name, cwd, role] of [
    ['foreign', f.root + '-other', '/root/rabbi_auth'],
    ['unknown', f.root, '/root/random_child'],
    ['backend', f.root, '/root/rabbi_auth_backend'],
    ['frontend', f.root, '/root/dashboard_ui'],
    ['qa', f.root, '/root/dashboard_qa'],
  ])
    await writeFile(
      path.join(f.sessionsRoot, `rollout-${name}.jsonl`),
      meta(cwd, name, role) + lifecycle('task_started'),
    );
  const watcher = await collector(t, f);
  const events = await readEvents(f.directory);
  assert.deepEqual(events.map((event) => event.agent).sort(), ['rabbi', 'shamim', 'tanvir']);
  assert.equal(watcher.status().sessions, 3);
  assert.equal(new Set(events.map((event) => event.sessionId)).size, 3);
});

test('tool invocations classify activities without persisting arguments or tool results', async (t) => {
  const f = await fixture(t);
  await writeFile(f.filename, meta(f.root));
  const watcher = await collector(t, f);
  const cases = [
    ['apply_patch', 'Writing code'],
    ['mcp__codebase__get_code_snippet', 'Reading files'],
    ['mcp__codebase__search_graph', 'Searching'],
    ['exec_command', 'Running commands'],
    ['exec_command', 'Reading files', 'await tools.exec_command({cmd:"Get-Content private-file"})'],
    ['exec_command', 'Searching', 'await tools.exec_command({cmd:"rg private-pattern"})'],
    [
      'exec_command',
      'Running tests',
      'await tools.exec_command({cmd:"pnpm --filter api test:unit"})',
    ],
    [
      'exec_command',
      'Running commands',
      'const text="tools.apply_patch(private-content)"; await tools.exec_command({cmd:"node private-script"})',
    ],
  ];
  let tick = 0;
  for (const [name, expected, input] of cases) {
    await appendFile(
      f.filename,
      entry(
        'response_item',
        {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: name,
          input:
            input ?? `await tools.${name}({secret:"private-password",prompt:"private-prompt"})`,
        },
        new Date(Date.parse(epoch) + ++tick).toISOString(),
      ),
    );
    await watcher.poll();
    const events = await readEvents(f.directory);
    assert.equal(events.at(-1).action, expected);
    await appendFile(
      f.filename,
      entry(
        'response_item',
        {
          type: 'custom_tool_call_output',
          call_id: name,
          output: 'private-tool-result',
        },
        new Date(Date.parse(epoch) + ++tick).toISOString(),
      ),
    );
    await watcher.poll();
  }
  const serialized = JSON.stringify(await readEvents(f.directory));
  assert.ok(!serialized.includes('private-'));
  assert.ok(!serialized.includes(f.sessionsRoot.replace(/\\/g, '\\\\')));
});

test('concurrent tool endings preserve outstanding activity; token heartbeat preserves action', async (t) => {
  const f = await fixture(t);
  await writeFile(f.filename, meta(f.root) + lifecycle('task_started'));
  const watcher = await collector(t, f);
  await appendFile(
    f.filename,
    entry(
      'response_item',
      { type: 'function_call', name: 'apply_patch', call_id: 'a' },
      '2026-10-12T10:00:01.000Z',
    ) +
      entry(
        'response_item',
        { type: 'function_call', name: 'exec_command', call_id: 'b' },
        '2026-10-12T10:00:02.000Z',
      ) +
      entry(
        'response_item',
        { type: 'function_call_output', call_id: 'b' },
        '2026-10-12T10:00:03.000Z',
      ) +
      lifecycle('token_count', '2026-10-12T10:00:04.000Z'),
  );
  await watcher.poll();
  const last = (await readEvents(f.directory)).at(-1);
  assert.equal(last.kind, 'heartbeat');
  assert.equal(last.action, 'Writing code');
  await appendFile(f.filename, lifecycle('turn_aborted', '2026-10-12T10:01:00.000Z'));
  await watcher.poll();
  assert.equal((await readEvents(f.directory)).at(-1).status, 'idle');
});

test('malformed and oversized lines recover, truncation restarts, closed collector stops', async (t) => {
  const f = await fixture(t);
  await writeFile(f.filename, meta(f.root));
  const watcher = await collector(t, f);
  await appendFile(
    f.filename,
    '{bad json}\n' + 'x'.repeat(600_000) + '\n' + lifecycle('task_started'),
  );
  await watcher.poll();
  assert.equal((await readEvents(f.directory)).at(-1).status, 'active');
  await writeFile(
    f.filename,
    meta(f.root) + lifecycle('task_complete', '2026-10-12T10:02:00.000Z'),
  );
  await watcher.poll();
  assert.equal((await readEvents(f.directory)).at(-1).status, 'completed');
  watcher.close();
  const before = watcher.status().count;
  await appendFile(f.filename, lifecycle('task_started'));
  await watcher.poll();
  assert.equal(watcher.status().count, before);
});

test('missing sessions directory exposes generic diagnostics without local paths', async (t) => {
  const f = await fixture(t);
  const watcher = await collector(t, {
    ...f,
    sessionsRoot: path.join(f.root, 'missing-private-path'),
  });
  assert.equal(watcher.status().available, false);
  assert.ok(watcher.status().errorGeneric);
  assert.ok(!JSON.stringify(watcher.status()).includes('private-path'));
});
