import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baselineEstimate, columnsFor, rewriteProgress, splitRow } from './delivery.mjs';

const legacy = [
  '### FEAT-001 Tenancy and organization — P0',
  '',
  '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | Updated |',
  '|---|---|---|---|---|---|---|---|',
  '| FEAT-001.3 | Brands | Done | Done | N/A | Done | — | 2026-10-12 Codex |',
  '',
].join('\n');

test('legacy table gains agent and verify estimates in agent-human-review mode', () => {
  const { text } = rewriteProgress(legacy, 'agent-human-review');
  const lines = text.split('\n');
  assert.deepEqual(splitRow(lines[2]), columnsFor('agent-human-review'));
  const row = Object.fromEntries(
    splitRow(lines[2]).map((name, i) => [name, splitRow(lines[4])[i]]),
  );
  assert.equal(row['Status'], 'Done');
  assert.equal(row['Updated'], '2026-10-12 Codex');
  // FE is N/A so it has no estimate.
  assert.equal(row['BE agent (h)'], '1.5');
  assert.equal(row['BE verify (h)'], '0.5');
  assert.equal(row['FE agent (h)'], '—');
  assert.equal(row['FE verify (h)'], '—');
});

test('fully-agentic drops verify columns and switching back restores baselines, keeping edited agent values', () => {
  const review = rewriteProgress(legacy, 'agent-human-review').text.replace(
    '| 1.5 | 0.5 |',
    '| 3 | 0.5 |',
  );
  const agentic = rewriteProgress(review, 'fully-agentic');
  assert.deepEqual(agentic.dropped.sort(), [
    'BE verify (h)',
    'FE verify (h)',
    'PM verify (h)',
    'QA verify (h)',
  ]);
  assert.ok(!agentic.text.includes('verify (h)'));
  assert.match(agentic.text, /\| 3 \|/);
  const back = rewriteProgress(agentic.text, 'agent-human-review').text;
  assert.match(back, /\| 3 \| 0\.5 \|/);
});

test('rewriting is idempotent and preserves CRLF', () => {
  const crlf = legacy.replace(/\n/g, '\r\n');
  const once = rewriteProgress(crlf, 'agent-human-review').text;
  assert.ok(once.includes('\r\n'));
  assert.equal(rewriteProgress(once, 'agent-human-review').text, once);
});

test('high-risk areas take 1.5x effort', () => {
  const deep = baselineEstimate({ subName: 'Tenant model and isolation' });
  assert.equal(deep['BE agent (h)'], 2.25);
  assert.equal(deep['PM verify (h)'], 0.5);
});

test('baseline adds QA effort for two-layer work', () => {
  const both = baselineEstimate({ subName: 'Color master', be: 'Todo', fe: 'Todo' });
  const one = baselineEstimate({ subName: 'Color master', be: 'Todo', fe: 'N/A' });
  assert.equal(both['QA agent (h)'], 1);
  assert.equal(one['QA agent (h)'], 0.75);
});
