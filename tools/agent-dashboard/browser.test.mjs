/* global window, document */
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createDashboard, ROOT } from './server.mjs';
import { report, STALE_MS } from './store.mjs';

const { chromium, expect } = createRequire(path.join(ROOT, 'apps/web/package.json'))(
  '@playwright/test',
);

async function fixture(
  t,
  viewport = { width: 1440, height: 1000 },
  collectCodex = false,
  route = '/',
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ims-dashboard-browser-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'context'));
  await writeFile(
    path.join(directory, 'context/task-board.md'),
    '| FEAT-046 | Local dashboard | QA | Tanvir | x.md |',
  );
  await writeFile(
    path.join(directory, 'context/feature-progress-list.md'),
    '| FEAT-046.1 | Telemetry | Done | Done | Done | Done | — | Today |',
  );
  await writeFile(
    path.join(directory, 'context/feature-queue.md'),
    '## Next to assign\n| 1 | FEAT-002 Authentication | P0 | 39 | IDs | — | Rabbi |\n## Work queues',
  );
  const sessionsRoot = path.join(directory, 'sessions');
  await mkdir(sessionsRoot);
  const avatars = path.join(directory, 'avatars');
  await mkdir(avatars);
  const dashboard = createDashboard({
    root: directory,
    directory,
    collectCodex,
    sessionsRoot,
    avatars,
  });
  await new Promise((resolve) => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'));
  await page.goto(`http://127.0.0.1:${dashboard.server.address().port}${route}`);
  await expect(page.locator('#connection-label')).toHaveText('Live connection');
  return { directory, dashboard, page, sessionsRoot, avatars };
}

// The crew cards and agent details live on the dashboard; the observatory is on the live page.
async function teamPage(page, dashboard) {
  const team = await page.context().browser().newPage({ viewport: page.viewportSize() });
  await team.goto(`http://127.0.0.1:${dashboard.server.address().port}/dashboard`);
  await expect(team.locator('#connection-label')).toHaveText('Live connection');
  return team;
}

test('browser: automatic collector drives the avatar from actual appended runtime records', async (t) => {
  const { directory, page, sessionsRoot } = await fixture(t, undefined, true);
  const folder = path.join(sessionsRoot, ...new Date().toISOString().slice(0, 10).split('-'));
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'rollout-live-test.jsonl');
  const row = (type, payload) =>
    JSON.stringify({ timestamp: new Date().toISOString(), type, payload }) + '\n';
  await writeFile(
    file,
    row('session_meta', { id: 'live-test', cwd: directory, agent_path: '/root/shamim_live' }) +
      row('event_msg', { type: 'task_started' }) +
      row('response_item', {
        type: 'custom_tool_call',
        name: 'exec',
        call_id: 'write-1',
        input: 'await tools.apply_patch("private-content-must-not-escape")',
      }),
  );
  await expect(page.locator('#collector-label')).toContainText('collector connected');
  await expect(page.locator('#stage-name')).toHaveText('Shamim');
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'coding');
  await appendFile(
    file,
    row('response_item', {
      type: 'custom_tool_call_output',
      call_id: 'write-1',
      output: 'private-content-must-not-escape',
    }) +
      row('response_item', {
        type: 'reasoning',
        encrypted_content: 'private-content-must-not-escape',
      }),
  );
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'thinking');
  await expect(page.locator('body')).not.toContainText('private-content-must-not-escape');
  await appendFile(
    file,
    row('event_msg', {
      type: 'task_complete',
      last_agent_message: 'private-content-must-not-escape',
    }),
  );
  await expect(page.locator('[data-stage-agent="shamim"]')).toHaveAttribute(
    'data-status',
    'completed',
  );
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'completed');
});

test('browser: five distinct loaded avatars, empty onboarding and assignment/runtime separation', async (t) => {
  const { dashboard, page } = await fixture(t);
  await expect(page.locator('.stage-agent')).toHaveCount(5);
  await expect(page.locator('#onboarding')).toBeVisible();
  await expect(page.locator('[data-stage-agent="nadia"]')).toBeVisible();
  const team = await teamPage(page, dashboard);
  await expect(team.locator('.agent-card')).toHaveCount(5);
  await expect(team.locator('.agent-card .status-badge')).toHaveText([
    'Idle',
    'Idle',
    'Idle',
    'Idle',
    'Idle',
  ]);
  // Nadia handles change requests beside the delivery pipeline, not as a handoff step.
  await expect(team.locator('.pipeline-step')).toHaveText(['Minhaj', 'Rabbi', 'Shamim', 'Tanvir']);
  const images = await team
    .locator('.agent-card img')
    .evaluateAll((items) =>
      items.map((image) => ({ src: image.src, loaded: image.complete && image.naturalWidth > 0 })),
    );
  assert.equal(new Set(images.map((image) => image.src)).size, 5);
  assert.ok(images.every((image) => image.loaded));
  await team.locator('[data-agent="tanvir"]').click();
  await expect(team.locator('.assignment-item')).toContainText('Local dashboard');
  await expect(team.locator('#detail-content')).toContainText('No runtime sessions reported.');
  await expect(team.locator('#active-count')).toHaveText('0');
  await expect(team.locator('#progress-summary')).toHaveText('1 of 1 work items complete');
  await expect(team.locator('#next-queue')).toContainText('Authentication');
});

test('browser: keyboard details, close focus restoration and navigation between pages', async (t) => {
  const { page } = await fixture(t, undefined, false, '/dashboard');
  const card = page.locator('[data-agent="rabbi"]');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-title')).toHaveText('Rabbi · details');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close agent details' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-content')).toBeHidden();
  await expect(card).toBeFocused();
  await page.getByRole('link', { name: 'Board', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/board');
  await page.getByRole('link', { name: 'Live agents' }).click();
  assert.equal(new URL(page.url()).pathname, '/');
  await expect(page.locator('#agent-stage')).toBeVisible();
  await page.getByRole('link', { name: 'Activity feed' }).click();
  assert.equal(new URL(page.url()).hash, '#activity');
  await page.getByRole('link', { name: 'Dashboard' }).click();
  assert.equal(new URL(page.url()).pathname, '/dashboard');
  await expect(page.locator('#kpi-percent')).toBeVisible();
});

test('browser: actual SSE updates, role/status filters, concurrent sessions and handoff', async (t) => {
  const { directory, dashboard, page } = await fixture(t);
  const team = await teamPage(page, dashboard);
  await report(directory, {
    agent: 'rabbi',
    source: 'codex',
    sessionId: 'backend',
    status: 'active',
    task: 'Verify live backend',
    feature: 'FEAT-046',
  });
  const card = team.locator('[data-agent="rabbi"]');
  await expect(card.locator('.agent-task')).toHaveText('Verify live backend');
  await expect(page.locator('#onboarding')).toBeHidden();
  await team.getByLabel('Filter by status').selectOption('active');
  await expect(team.locator('.agent-card:visible')).toHaveCount(1);
  await team.getByLabel('Filter by role').selectOption('tanvir');
  await expect(team.locator('#no-match')).toBeVisible();
  await team.getByLabel('Filter by role').selectOption('rabbi');
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'other',
    status: 'completed',
    task: 'Separate session',
    handoffTo: 'shamim',
  });
  await expect(page.locator('#timeline')).toContainText('→ shamim');
  await expect(card.locator('.status-badge')).toHaveText('Active');
  await card.click();
  await expect(team.locator('.session-item')).toHaveCount(2);
  await expect(team.locator('#detail-content')).toContainText('codex:backend');
  await expect(team.locator('#detail-content')).toContainText('claude:other');
  await report(directory, {
    agent: 'rabbi',
    source: 'codex',
    sessionId: 'backend',
    status: 'completed',
    task: 'Backend ready',
    handoffTo: 'shamim',
  });
  await expect(team.locator('#no-match')).toBeVisible();
  await team.getByLabel('Filter by status').selectOption('completed');
  await expect(card).toBeVisible();
  await expect(card.locator('.status-badge')).toHaveText('Completed');
});

test('browser: old reports become stale and a real heartbeat restores task without timeline noise', async (t) => {
  const { directory, dashboard, page } = await fixture(t);
  const team = await teamPage(page, dashboard);
  await report(
    directory,
    { agent: 'shamim', source: 'codex', sessionId: 'frontend', status: 'active', task: 'UI task' },
    new Date(Date.now() - STALE_MS - 5000),
  );
  const card = team.locator('[data-agent="shamim"]');
  await expect(card.locator('.status-badge')).toHaveText('Stale');
  await expect(page.locator('[data-stage-agent="shamim"]')).toHaveAttribute('data-status', 'stale');
  await report(directory, {
    agent: 'shamim',
    source: 'codex',
    sessionId: 'frontend',
    status: 'active',
    kind: 'heartbeat',
  });
  await expect(card.locator('.status-badge')).toHaveText('Active');
  await expect(card.locator('.agent-task')).toHaveText('UI task');
  await expect(page.locator('#timeline .timeline-item')).toHaveCount(1);
});

test('browser: untrusted event text stays literal across cards, details and timeline', async (t) => {
  const { directory, dashboard, page } = await fixture(t);
  const team = await teamPage(page, dashboard);
  const task =
    '<img src=x onerror="window.dashboardXss=true"><script>window.dashboardXss=true</script>';
  await report(directory, {
    agent: 'tanvir',
    source: 'codex',
    sessionId: 'xss',
    status: 'active',
    task,
  });
  await expect(team.locator('[data-agent="tanvir"] .agent-task')).toHaveText(task);
  await team.locator('[data-agent="tanvir"]').click();
  await expect(team.locator('#detail-content')).toContainText(task);
  await expect(page.locator('#timeline')).toContainText(task);
  assert.equal(await page.evaluate(() => Object.hasOwn(window, 'dashboardXss')), false);
  assert.equal(
    (await page.locator('#timeline script').count()) +
      (await team.locator('#detail-content script, .agent-task img').count()),
    0,
  );
});

test('browser: mobile layout has no horizontal overflow including open details and long text', async (t) => {
  const { directory, dashboard, page } = await fixture(
    t,
    { width: 375, height: 812 },
    false,
    '/dashboard',
  );
  await report(directory, {
    agent: 'minhaj',
    source: 'codex',
    sessionId: 'mobile',
    status: 'active',
    task: 'A'.repeat(180),
  });
  await expect(page.locator('[data-agent="minhaj"] .status-badge')).toHaveText('Active');
  await page.locator('[data-agent="minhaj"]').click();
  await expect(page.locator('#detail-content')).toBeVisible();
  const overflow = () =>
    page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
  const dashboardSize = await overflow();
  assert.ok(dashboardSize.scroll <= dashboardSize.viewport, JSON.stringify(dashboardSize));
  for (const route of ['/', '/board', '/wbs']) {
    await page.goto(`http://127.0.0.1:${dashboard.server.address().port}${route}`);
    await expect(page.locator('#connection-label')).not.toHaveText('Connecting…');
    const size = await overflow();
    assert.ok(size.scroll <= size.viewport, `${route} ${JSON.stringify(size)}`);
  }
});

test('browser: stopping its own server shows the disconnected warning and preserves last snapshot', async (t) => {
  const { dashboard, page } = await fixture(t);
  dashboard.close();
  await expect(page.locator('#connection-warning')).toBeVisible();
  await expect(page.locator('#connection-label')).toContainText('Disconnected');
  await expect(page.locator('.stage-agent')).toHaveCount(5);
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'disconnected');
});

test('browser: central avatar follows real actions, pins agents and selects concurrent sessions', async (t) => {
  const { directory, page } = await fixture(t);
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'read',
    status: 'active',
    action: 'Using Read',
    task: 'Inspect implementation',
  });
  await expect(page.locator('#stage-name')).toHaveText('Rabbi');
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'reading');
  await expect(page.locator('[data-activity="reading"]')).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await expect(page.locator('#agent-stage')).toHaveClass(/motion-paused/);
  await report(directory, {
    agent: 'rabbi',
    source: 'codex',
    sessionId: 'write',
    status: 'active',
    action: 'Writing code',
    task: 'Implement change',
  });
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'coding');
  await page.getByLabel('Choose agent session').selectOption('claude:read');
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'reading');
  await expect(page.locator('#stage-mode')).toHaveText('PINNED AGENT');
  await report(directory, {
    agent: 'shamim',
    source: 'codex',
    sessionId: 'ui',
    status: 'active',
    action: 'Thinking about layout',
  });
  await expect(page.locator('[data-stage-agent="shamim"]')).toHaveAttribute(
    'data-status',
    'active',
  );
  await expect(page.locator('#stage-name')).toHaveText('Rabbi');
  await page.getByRole('button', { name: 'Follow live' }).click();
  await expect(page.locator('#stage-name')).toHaveText('Shamim');
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'thinking');
  await page.getByRole('button', { name: 'Focus on Tanvir' }).click();
  await expect(page.locator('#stage-name')).toHaveText('Tanvir');
  await expect(page.locator('#agent-stage')).toHaveAttribute('data-state', 'idle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await page.getByRole('button', { name: 'Follow live' }).click();
  assert.equal(
    await page
      .locator('.orbit-ring')
      .first()
      .evaluate((element) => window.getComputedStyle(element).animationName),
    'none',
  );
});

test('browser: WBS page shows the full progress list with estimates, filters and no mobile overflow', async (t) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 375, height: 812 },
  ]) {
    const { directory, dashboard, page } = await fixture(t, viewport);
    await writeFile(
      path.join(directory, 'context/delivery-config.json'),
      '{"mode":"agent-human-review"}',
    );
    await writeFile(
      path.join(directory, 'context/feature-progress-list.md'),
      [
        '## Stage 1 — Foundation',
        '### FEAT-003 Roles and permissions — P0',
        '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | PM verify (h) | BE agent (h) | BE verify (h) | FE agent (h) | FE verify (h) | QA agent (h) | QA verify (h) | Updated |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| FEAT-003.1 | Predefined roles | Backend | Review | Todo | Todo | — | 0.5 | 0.5 | 2.25 | 0.75 | 2.25 | 0.75 | 1.5 | 0.5 | Today |',
        '| FEAT-003.2 | <img src=x onerror=alert(1)> | Done | Done | N/A | Done | — | 0.25 | 0.25 | 1.5 | 0.5 | — | — | 0.75 | 0.25 | Today |',
        '## Stage 2 — Inventory',
        '### FEAT-010 Stock ledger — P0',
        '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | PM verify (h) | BE agent (h) | BE verify (h) | FE agent (h) | FE verify (h) | QA agent (h) | QA verify (h) | Updated |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| FEAT-010.1 | Ledger posting | Blocked | Todo | Todo | Todo | — | 0.5 | 0.5 | 2.25 | 0.75 | 2.25 | 0.75 | 1.5 | 0.5 | — |',
      ].join('\n'),
    );
    await page.goto(`http://127.0.0.1:${dashboard.server.address().port}/wbs`);
    await expect(page.locator('#connection-label')).toHaveText('Live from tracker');
    await expect(page.locator('#wbs-mode')).toHaveText('Agent + human review');
    await expect(page.locator('#wbs-done')).toHaveText('1 / 3');
    await expect(page.locator('#wbs-human-metric')).toBeVisible();
    await expect(page.locator('#wbs-blocked')).toHaveText('1 · 1');
    // In-progress feature opens by default; its row shows the human verify estimate.
    const row = page.locator('tr[data-sub="FEAT-003.1"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('0.75');
    await expect(page.locator('tr[data-sub="FEAT-003.2"] td.name')).toHaveText(
      '<img src=x onerror=alert(1)>',
    );
    await page.selectOption('#status-filter', 'Review');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.selectOption('#status-filter', 'all');
    await page.fill('#search', 'ledger');
    await expect(page.locator('tr[data-sub="FEAT-010.1"]')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.fill('#search', 'nothing-matches');
    await expect(page.locator('#wbs-empty')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
  }
});

test('browser: switching to fully-agentic hides human review estimates', async (t) => {
  const { directory, dashboard, page } = await fixture(t);
  await writeFile(path.join(directory, 'context/delivery-config.json'), '{"mode":"fully-agentic"}');
  await writeFile(
    path.join(directory, 'context/feature-progress-list.md'),
    [
      '## Stage 1 — Foundation',
      '### FEAT-004 Audit log — P0',
      '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| FEAT-004.1 | Audit event recording | Backend | In progress | Todo | Todo | — | 0.25 | 1.5 | 1.5 | 1 | — |',
    ].join('\n'),
  );
  await page.goto(`http://127.0.0.1:${dashboard.server.address().port}/wbs`);
  await expect(page.locator('#wbs-mode')).toHaveText('Fully agentic');
  await expect(page.locator('#wbs-human-metric')).toBeHidden();
  await expect(page.locator('#wbs-agent')).toHaveText('4.25 · 4.25');
  await expect(page.locator('th.human')).toHaveCount(0);
  await page.getByRole('link', { name: 'Live agents' }).click();
  await expect(page.locator('#connection-label')).toHaveText('Live connection');
});

test('browser: thumbnails glow by status and the current activity sends light into the center agent', async (t) => {
  const { directory, page } = await fixture(t);
  await expect(page.locator('.stage-agent[data-status="idle"]')).toHaveCount(5);
  await expect(page.locator('.hub-line')).toHaveCount(6);
  await expect(page.locator('.hub-line.is-lit')).toHaveCount(0);
  await report(directory, {
    agent: 'tanvir',
    source: 'claude',
    sessionId: 'b',
    status: 'waiting',
    action: 'Waiting for input',
  });
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'a',
    status: 'active',
    action: 'Thinking about the plan',
  });
  const rabbi = page.locator('[data-stage-agent="rabbi"]');
  await expect(rabbi).toHaveAttribute('data-status', 'active');
  await expect(rabbi.locator('.node-activity')).toHaveText('Thinking / planning');
  await expect(page.locator('[data-stage-agent="tanvir"]')).toHaveAttribute(
    'data-status',
    'waiting',
  );
  await expect(page.locator('[data-stage-agent="nadia"]')).toHaveAttribute('data-status', 'idle');
  // Rabbi is in the center; only the Thinking path is lit and its pulses travel to him.
  await expect(page.locator('#stage-name')).toHaveText('Rabbi');
  await expect(page.locator('.hub-line.is-lit')).toHaveCount(1);
  await expect(page.locator('.hub-pulse.is-lit')).toHaveCount(3);
  await expect(page.locator('[data-activity="thinking"]')).toHaveClass(/is-current/);
  const animation = (selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => window.getComputedStyle(el).animationName);
  assert.equal(await animation('.hub-line.is-lit'), 'line-flow');
  assert.equal(await animation('.hub-pulse.is-lit'), 'pulse-travel');
  // A new activity moves the light to its own path.
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'a',
    status: 'active',
    action: 'Using Bash',
  });
  await expect(page.locator('[data-activity="running"]')).toHaveClass(/is-current/);
  await expect(page.locator('.hub-line.is-lit')).toHaveCount(1);
  await expect(page.locator('[data-activity="thinking"]')).not.toHaveClass(/is-current/);
});

test('browser: a real photo replaces the illustrated avatar and falls back when it breaks', async (t) => {
  const { dashboard, page, avatars } = await fixture(t);
  const photo = path.join(avatars, 'nadia.png');
  // 1x1 transparent PNG: valid image bytes served as Nadia's photo.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await writeFile(photo, png);
  await page.reload();
  await expect(page.locator('[data-stage-agent="nadia"] img')).toHaveAttribute(
    'src',
    '/avatars/nadia.png',
  );
  const team = await teamPage(page, dashboard);
  await expect(team.locator('.agent-card[data-agent="nadia"] img')).toHaveAttribute(
    'src',
    '/avatars/nadia.png',
  );
  // Corrupt bytes: the browser cannot decode it, so the illustration comes back.
  await writeFile(photo, 'not an image');
  await team.reload();
  await expect(team.locator('.agent-card[data-agent="nadia"] img')).toHaveAttribute(
    'src',
    '/avatars/nadia.svg',
  );
});

test('browser: workflow chip tells named agents from the main session alone', async (t) => {
  const { directory, page } = await fixture(t);
  const chip = page.locator('#workflow-status');
  await expect(chip).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#workflow-label')).toHaveText('Idle · no active work');
  await report(directory, {
    agent: 'main',
    source: 'claude',
    sessionId: 'm/main',
    status: 'active',
    action: 'Using Bash',
  });
  await expect(chip).toHaveAttribute('data-state', 'main');
  await expect(page.locator('#workflow-label')).toHaveText(
    'Main session only · no agents dispatched',
  );
  // The main session never becomes an agent card or a center-stage agent.
  await expect(page.locator('.stage-agent[data-status="active"]')).toHaveCount(0);
  await report(directory, { agent: 'rabbi', source: 'claude', sessionId: 'm/r', status: 'active' });
  await report(directory, {
    agent: 'tanvir',
    source: 'claude',
    sessionId: 'm/t',
    status: 'waiting',
  });
  await expect(chip).toHaveAttribute('data-state', 'agents');
  await expect(page.locator('#workflow-label')).toHaveText(
    'Agentic workflow running · Rabbi, Tanvir',
  );
});

const trackerFixture = [
  '## Stage 1 — Foundation',
  '### FEAT-027 Cash shifts and register — P0',
  '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| FEAT-027.1 | Register setup | Backend | In progress | Todo | Todo | — | 1 | 2.5 | 2 | 1.5 | — |',
  '| FEAT-027.2 | Open shift | Backend | In progress | Todo | Todo | — | 0.5 | 4 | 3 | 2.5 | — |',
].join('\n');

test('browser: the observatory shows the feature, its progress, run time and a playful label', async (t) => {
  const { directory, page } = await fixture(t);
  await writeFile(path.join(directory, 'context/feature-progress-list.md'), trackerFixture);
  await writeFile(path.join(directory, 'context/delivery-config.json'), '{"mode":"fully-agentic"}');
  const now = Date.now();
  for (const minutes of [6, 3, 0])
    await report(
      directory,
      {
        agent: 'rabbi',
        source: 'claude',
        sessionId: 'w',
        status: 'active',
        contextRoot: directory,
      },
      new Date(now - minutes * 60_000),
    );
  await expect(page.locator('#stage-name')).toHaveText('Rabbi');
  await expect(page.locator('#stage-work')).toBeVisible();
  await expect(page.locator('#stage-feature-id')).toHaveText('FEAT-027');
  await expect(page.locator('#stage-feature-name')).toHaveText('Cash shifts and register');
  await expect(page.locator('#stage-feature-detail')).toHaveText('Backend · 1, 2');
  await expect(page.locator('#stage-progress-text')).toHaveText('0%');
  await expect(page.locator('#stage-progress-detail')).toContainText('0 of 6 layers done');
  await expect(page.locator('#stage-runtime')).toHaveText(/^6m \d\ds$/);
  await expect(page.locator('#stage-total')).toHaveText(/^6m \d\ds across 1 run$/);
  await expect(page.locator('[data-stage-agent="rabbi"] .node-feature')).toHaveText('FEAT-027');
  // No action was reported, so the label is playful instead of "action unspecified".
  await expect(page.locator('#stage-state')).toHaveText(/…$/);
  await expect(page.locator('#stage-state')).not.toContainText('unspecified');
  // The run time keeps ticking without a new event.
  const before = await page.locator('#stage-runtime').textContent();
  await expect(page.locator('#stage-runtime')).not.toHaveText(before ?? '', { timeout: 5000 });
});

test('browser: the WBS shows who is working, estimate / actual hours, and updates in realtime', async (t) => {
  const { directory, dashboard, page } = await fixture(t);
  await writeFile(path.join(directory, 'context/feature-progress-list.md'), trackerFixture);
  await writeFile(path.join(directory, 'context/delivery-config.json'), '{"mode":"fully-agentic"}');
  const now = Date.now();
  for (let step = 8; step >= 0; step--)
    await report(
      directory,
      {
        agent: 'rabbi',
        source: 'claude',
        sessionId: 'w',
        status: 'active',
        contextRoot: directory,
      },
      new Date(now - step * 5 * 60_000),
    );
  await page.goto(`http://127.0.0.1:${dashboard.server.address().port}/wbs`);
  await expect(page.locator('#wbs-mode')).toHaveText('Fully agentic');
  const chip = page.locator('.live-chip');
  await expect(chip).toContainText('Rabbi · BE');
  await expect(page.locator('tr[data-sub="FEAT-027.1"]')).toHaveClass(/is-live/);
  // 40 minutes of work split over two sub-features: 0.33 h each next to the 2.5 h estimate.
  await expect(page.locator('tr[data-sub="FEAT-027.1"] td.agent .actual').first()).toHaveText(
    '/ 0.33',
  );
  await expect(page.locator('#wbs-actual')).toHaveText('0.67 h');
  // Realtime: finishing the run clears the live marker without reloading the page.
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'w',
    status: 'completed',
    contextRoot: directory,
  });
  await expect(page.locator('.live-chip')).toHaveCount(0);
  await expect(page.locator('tr[data-sub="FEAT-027.1"]')).not.toHaveClass(/is-live/);
});

test('browser: the dashboard shows KPIs and charts, and the board has its own page', async (t) => {
  const { directory, dashboard, page } = await fixture(t, undefined, false, '/dashboard');
  await writeFile(
    path.join(directory, 'context/feature-progress-list.md'),
    [
      '## Stage 1 — Foundation',
      '### FEAT-003 Roles and permissions — P0',
      '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| FEAT-003.1 | Predefined roles | QA | Done | Done | In progress | — | 0.5 | 2 | 2 | 1.5 | — |',
      '### FEAT-027 Cash shifts and register — P0',
      '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| FEAT-027.1 | Register setup | Backend | In progress | Todo | Todo | — | 1 | 2.5 | 2 | 1.5 | — |',
      '### FEAT-030 Offline POS — P0',
      '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| FEAT-030.1 | Offline queue | Blocked | Todo | Todo | Todo | — | 1 | 3 | 3 | 2 | — |',
      '### FEAT-099 Setup — P0',
      '| ID | Sub-feature | Status | BE (Rabbi) | FE (Shamim) | QA (Tanvir) | Bugs | PM agent (h) | BE agent (h) | FE agent (h) | QA agent (h) | Updated |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| FEAT-099.1 | Scaffold | Done | Done | N/A | Done | — | 0.25 | 1 | — | 0.5 | — |',
    ].join('\n'),
  );
  await writeFile(path.join(directory, 'context/delivery-config.json'), '{"mode":"fully-agentic"}');
  await page.reload();
  // Dashboard: health numbers and the four charts; the board is not on this page.
  await expect(page.locator('#kpi-percent')).toHaveText('25%');
  await expect(page.locator('#kpi-done')).toHaveText('1 of 4 sub-features done');
  await expect(page.locator('#kpi-blocked')).toHaveText('1');
  await expect(page.locator('#mode-chip')).toHaveText('Fully agentic');
  await expect(page.locator('#chart-status svg.donut')).toBeVisible();
  await expect(page.locator('#chart-stages .stage-row')).toHaveCount(1);
  await expect(page.locator('#chart-hours .hour-row')).not.toHaveCount(0);
  await expect(page.locator('#board, #kanban')).toHaveCount(0);
  // Board page: each feature sits in the column for where it is in delivery.
  await page.getByRole('link', { name: 'Board', exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.locator('#board-total')).toHaveText('4 features');
  const inColumn = (column, id) => page.locator(`.column-${column} [data-feature="${id}"]`);
  await expect(inColumn('qa', 'FEAT-003')).toBeVisible();
  await expect(inColumn('building', 'FEAT-027')).toBeVisible();
  await expect(inColumn('blocked', 'FEAT-030')).toBeVisible();
  await expect(inColumn('done', 'FEAT-099')).toBeVisible();
  await expect(page.locator('.column-backlog .column-empty')).toBeVisible();
  // A working agent shows up on its feature card without a reload.
  await report(directory, {
    agent: 'rabbi',
    source: 'claude',
    sessionId: 'board',
    status: 'active',
    contextRoot: directory,
  });
  await expect(inColumn('building', 'FEAT-027').locator('.card-live')).toContainText('Rabbi');
  await page.selectOption('#board-stage', { index: 1 });
  await expect(page.locator('#board-total')).toHaveText('4 features');
  assert.ok(dashboard);
});
