import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readEvents } from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ims-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function execute(args, directory, stdin = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: here,
      env: { ...process.env, AGENT_DASHBOARD_DATA_DIR: directory },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, output }));
    child.stdin.end(stdin);
  });
}

test('command wrapper records success and failure without command output in telemetry', async (t) => {
  const directory = await fixture(t);
  const prefix = [
    'report.mjs',
    '--agent',
    'tanvir',
    '--session',
    'wrapper',
    '--task',
    'QA checks',
    '--run',
    '--',
    process.execPath,
  ];
  const success = await execute(
    [...prefix, '-e', 'console.log("private command output")'],
    directory,
  );
  assert.equal(success.code, 0);
  const successEvents = await readEvents(directory);
  assert.equal(successEvents.at(-1).status, 'completed');
  assert.doesNotMatch(JSON.stringify(successEvents), /private command output|console.log/);
  const failed = await execute([...prefix, '-e', 'process.exit(3)'], directory);
  assert.equal(failed.code, 3);
  assert.equal((await readEvents(directory)).at(-1).status, 'failed');
});

test('a missing executable fails cleanly instead of leaving an active command', async (t) => {
  const directory = await fixture(t);
  const result = await execute(
    [
      'report.mjs',
      '--agent',
      'rabbi',
      '--session',
      'missing',
      '--run',
      '--',
      'ims-definitely-missing-executable',
    ],
    directory,
  );
  assert.equal(result.code, 1);
  assert.equal((await readEvents(directory)).at(-1).status, 'failed');
});

test(
  'long command emits actual heartbeat without recording it in the activity timeline',
  { timeout: 25000 },
  async (t) => {
    const directory = await fixture(t);
    const result = await execute(
      [
        'report.mjs',
        '--agent',
        'tanvir',
        '--session',
        'long-command',
        '--task',
        'Long QA check',
        '--run',
        '--',
        process.execPath,
        '-e',
        'setTimeout(() => {}, 16500)',
      ],
      directory,
    );
    assert.equal(result.code, 0);
    const events = await readEvents(directory);
    const heartbeat = events.find((event) => event.kind === 'heartbeat');
    assert.ok(heartbeat, 'The command really ran through the 15-second heartbeat interval');
    assert.equal(heartbeat.status, 'active');
    assert.equal(heartbeat.sessionId, 'codex:long-command');
    assert.equal(heartbeat.task, 'Long QA check');
    assert.equal(events.at(-1).status, 'completed');
    assert.equal(events.filter((event) => event.kind !== 'heartbeat').length, 2);
    assert.doesNotMatch(JSON.stringify(events), /setTimeout|16500/);
  },
);

test('Claude hook consumes stdin, keeps only metadata and does not block malformed input', async (t) => {
  const directory = await fixture(t);
  const input = JSON.stringify({
    session_id: 'test-session',
    hook_event_name: 'SubagentStart',
    agent_id: 'one',
    agent_type: 'tanvir-qa-automation',
    prompt: 'private prompt',
    tool_input: { token: 'private-token' },
  });
  assert.equal((await execute(['claude-hook.mjs'], directory, input)).code, 0);
  const events = await readEvents(directory);
  assert.equal(events[0].agent, 'tanvir');
  assert.equal(events[0].status, 'active');
  assert.doesNotMatch(JSON.stringify(events), /private/);
  assert.equal((await execute(['claude-hook.mjs'], directory, '{broken')).code, 0);
});

test('configured Claude hooks use supported events and direct executable arguments', async () => {
  const settings = JSON.parse(
    await readFile(path.resolve(here, '../../.claude/settings.json'), 'utf8'),
  );
  for (const event of [
    'SessionStart',
    'SubagentStart',
    'SubagentStop',
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'SessionEnd',
  ]) {
    const handler = settings.hooks[event][0].hooks[0];
    assert.equal(handler.command, 'node');
    assert.deepEqual(handler.args, ['${CLAUDE_PROJECT_DIR}/tools/agent-dashboard/claude-hook.mjs']);
  }
});
