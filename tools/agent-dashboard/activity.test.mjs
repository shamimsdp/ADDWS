import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityOf } from './public/activity.js';
import { hookEvent } from './claude-hook.mjs';

test('activity uses observed tools and explicit reports, never task descriptions', () => {
  for (const [action, expected] of [
    ['Using Read', 'reading'],
    ['Using Edit', 'coding'],
    ['Using Write', 'coding'],
    ['Using Grep', 'searching'],
    ['Using Bash', 'running'],
    ['Thinking about the approach', 'thinking'],
    ['Running tests', 'testing'],
    ['Post Tool Use', 'working'],
    ['', 'working'],
  ])
    assert.equal(activityOf({ status: 'active', action, task: 'Writing code' }), expected);
  for (const status of ['waiting', 'stale', 'completed', 'failed', 'idle']) {
    assert.equal(activityOf({ status, action: 'Using Edit' }), status);
  }
  assert.equal(activityOf({ status: 'active', action: 'Using Read' }, true), 'disconnected');
});

test('Claude tool start is classified but tool completion does not claim continued execution', () => {
  const input = { session_id: 'test', tool_name: 'Read', hook_event_name: 'PreToolUse' };
  assert.equal(activityOf(hookEvent(input)), 'reading');
  assert.equal(activityOf(hookEvent({ ...input, hook_event_name: 'PostToolUse' })), 'working');
});
