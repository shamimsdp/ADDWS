/* Local, read-only telemetry UI. Event text is always inserted as text, never HTML. */
import { activityOf, activities } from './activity.js';
const $ = (id) => document.getElementById(id);
const roles = {
  minhaj: { name: 'Minhaj', role: 'Project manager', tag: 'THE PLANNER', color: '#dcecc7' },
  rabbi: { name: 'Rabbi', role: 'Backend developer', tag: 'THE BUILDER', color: '#c9e1f2' },
  shamim: { name: 'Shamim', role: 'Frontend developer', tag: 'THE DESIGNER', color: '#f2dcc5' },
  tanvir: { name: 'Tanvir', role: 'QA automation', tag: 'THE GUARDIAN', color: '#ded6ef' },
};
const labels = {
  active: 'Active',
  waiting: 'Waiting',
  idle: 'Idle',
  completed: 'Completed',
  failed: 'Failed',
  stale: 'Stale',
};
const cards = new Map();
let snapshot;
let selected;
let connectionVersion = 0;
let disconnected = true;
let followLive = true;
let stageAgent = 'minhaj';
let stageSession = '';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
function set(id, value) {
  $(id).textContent = String(value ?? '—');
}
function avatar(id, className = '') {
  const element = node('img', className);
  element.src = `/avatars/${Object.hasOwn(roles, id) ? id : 'minhaj'}.svg`;
  element.alt = '';
  element.width = 64;
  element.height = 64;
  return element;
}
function statusOf(value) {
  return Object.hasOwn(labels, value) ? value : 'idle';
}
function badge(status) {
  return node('span', `status-badge status-${statusOf(status)}`, labels[statusOf(status)]);
}
function timeValue(value) {
  const time = new Date(value ?? '').getTime();
  return Number.isFinite(time) ? time : null;
}
function relative(value) {
  const time = timeValue(value);
  if (time === null) return 'Not reported';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
function elapsed(value) {
  const start = timeValue(value);
  if (start === null) return 'Start not reported';
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m elapsed`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s elapsed`
      : `${seconds}s elapsed`;
}
function timeNode(value, prefix = '') {
  const element = node('time', '', prefix + relative(value));
  element.dataset.time = value ?? '';
  element.dataset.prefix = prefix;
  const time = timeValue(value);
  if (time !== null) {
    element.dateTime = new Date(time).toISOString();
    element.title = new Date(time).toLocaleString();
  }
  return element;
}
function sourceLabel(source) {
  return source || 'Source not reported';
}
function latestTask(agent) {
  return (
    agent.current?.task ||
    agent.current?.action ||
    (agent.status === 'stale'
      ? 'Reporting stopped; session may have ended.'
      : 'No runtime task reported.')
  );
}
function agents() {
  return Array.isArray(snapshot?.agents) ? snapshot.agents : [];
}
function assignmentsFor(id) {
  return (snapshot?.assignments ?? []).filter(
    (item) =>
      item.agent === id ||
      String(item.owner ?? '')
        .toLowerCase()
        .includes(id),
  );
}
function setConnection(connected) {
  disconnected = !connected;
  $('connection').classList.toggle('disconnected', !connected);
  set('connection-label', connected ? 'Live connection' : 'Disconnected · reconnecting');
  $('connection-warning').hidden = connected;
  renderStage();
  renderCollector();
}

for (const [id, role] of Object.entries(roles)) {
  const button = node('button', 'agent-card');
  button.type = 'button';
  button.dataset.agent = id;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `View ${role.name}, ${role.role}`);
  const portrait = node('div', 'portrait');
  portrait.style.setProperty('--portrait-bg', role.color);
  portrait.append(node('span', 'portrait-label', role.tag), avatar(id));
  const body = node('div', 'card-body');
  const heading = node('div', 'agent-heading');
  const status = badge('idle');
  heading.append(node('h3', '', role.name), status);
  const task = node('p', 'agent-task', 'Waiting for first snapshot.');
  const footer = node('div', 'card-footer');
  const seen = node('span', '', 'No telemetry yet');
  footer.append(seen, node('span', 'view-agent', 'View agent ↗'));
  body.append(
    heading,
    node('p', 'agent-role', role.role),
    node('p', 'task-label', 'REPORTED WORK'),
    task,
    footer,
  );
  button.append(portrait, body);
  button.addEventListener('click', () => {
    selected = id;
    pinAgent(id);
    for (const [cardId, card] of cards)
      card.button.setAttribute('aria-pressed', String(cardId === id));
    renderDetail();
    if (matchMedia('(max-width:600px)').matches)
      $('detail-title').scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  cards.set(id, { button, status, task, seen });
  $('agent-grid').append(button);
  const step = node('div', 'pipeline-step');
  step.append(avatar(id), node('span', '', role.name));
  if ($('pipeline').children.length) $('pipeline').append(node('span', 'pipeline-arrow', '→'));
  $('pipeline').append(step);
  const selector = node('button', 'stage-agent');
  selector.type = 'button';
  selector.setAttribute('aria-label', `Focus on ${role.name}`);
  selector.setAttribute('aria-pressed', 'false');
  selector.dataset.stageAgent = id;
  selector.append(avatar(id), node('span', '', role.name));
  selector.addEventListener('click', () => pinAgent(id));
  $('stage-team').append(selector);
}

function pinAgent(id) {
  stageAgent = id;
  stageSession = '';
  followLive = false;
  renderStage();
}
$('follow-live').addEventListener('click', () => {
  followLive = !followLive;
  stageSession = '';
  renderStage();
});
$('motion-toggle').addEventListener('click', () => {
  const paused = $('agent-stage').classList.toggle('motion-paused');
  $('motion-toggle').setAttribute('aria-pressed', String(paused));
  set('motion-toggle', paused ? 'Resume motion' : 'Pause motion');
});
$('stage-session').addEventListener('change', () => {
  stageSession = $('stage-session').value;
  followLive = false;
  renderStage();
});
function renderStage() {
  if (followLive) {
    const live = agents().filter((agent) => ['active', 'waiting'].includes(agent.status));
    live.sort((a, b) => (timeValue(b.lastSeen) ?? 0) - (timeValue(a.lastSeen) ?? 0));
    if (live[0]) stageAgent = live[0].id;
  }
  const role = roles[stageAgent];
  const agent = agents().find((item) => item.id === stageAgent);
  const sessions = agent?.sessions ?? [];
  if (stageSession && !sessions.some((session) => session.sessionId === stageSession))
    stageSession = '';
  const session = sessions.find((item) => item.sessionId === stageSession) ?? agent?.current;
  const current = session
    ? { ...session, status: stageSession ? session.status : agent.status }
    : { status: agent?.status ?? 'idle' };
  // Stop activity motion when a disconnected snapshot ages, even without another server update.
  const state = activityOf(current, disconnected);
  $('agent-stage').dataset.state = state;
  $('stage-avatar').src = `/avatars/${stageAgent}.svg`;
  set('stage-name', role.name);
  set('stage-role', role.role);
  set('stage-state', activities[state]?.[0] ?? 'Ready for work');
  set('stage-symbol', activities[state]?.[1] ?? '◷');
  set('stage-task', session?.task || 'No runtime task reported.');
  set('stage-action', session?.action || 'No action reported');
  $('stage-seen').replaceChildren(timeNode(session?.at));
  set('stage-source', sourceLabel(session?.source));
  set('stage-mode', followLive ? 'FOLLOWING LIVE ACTIVITY' : 'PINNED AGENT');
  $('follow-live').setAttribute('aria-pressed', String(followLive));
  for (const button of $('stage-team').children)
    button.setAttribute('aria-pressed', String(button.dataset.stageAgent === stageAgent));
  for (const station of document.querySelectorAll('[data-activity]')) {
    const active = station.dataset.activity === state;
    station.classList.toggle('is-current', active);
    if (active) station.setAttribute('aria-current', 'true');
    else station.removeAttribute('aria-current');
  }
  const options = [
    ['', 'Most relevant session'],
    ...sessions.map((item) => [
      item.sessionId,
      `${item.sessionId} · ${labels[statusOf(item.status)]}`,
    ]),
  ];
  if (!sessions.length) options[0][1] = 'No sessions reported';
  // Keep the focused select and its options stable through heartbeat updates.
  const fingerprint = JSON.stringify(options);
  if ($('stage-session').dataset.options !== fingerprint) {
    $('stage-session').replaceChildren(
      ...options.map(([value, label]) => {
        const option = node('option', '', label);
        option.value = value;
        return option;
      }),
    );
    $('stage-session').dataset.options = fingerprint;
  }
  $('stage-session').value = stageSession;
  $('stage-session').disabled = !sessions.length;
  set(
    'stage-evidence',
    state === 'thinking'
      ? 'Thinking was reported as a runtime phase. Private reasoning is not visible.'
      : state === 'disconnected' || state === 'stale'
        ? 'Activity paused: fresh telemetry is unavailable.'
        : state === 'working'
          ? 'Session is active. Its current activity has not been specified.'
          : 'Activity follows reported action metadata; task text does not imply execution.',
  );
}

function applyFilters() {
  let visible = 0;
  for (const [id, card] of cards) {
    const agent = agents().find((item) => item.id === id);
    const match =
      ($('role-filter').value === 'all' || $('role-filter').value === id) &&
      ($('status-filter').value === 'all' || $('status-filter').value === statusOf(agent?.status));
    card.button.hidden = !match;
    if (match) visible += 1;
  }
  $('no-match').hidden = visible > 0;
}
$('role-filter').addEventListener('change', applyFilters);
$('status-filter').addEventListener('change', applyFilters);
$('close-detail').addEventListener('click', () => {
  const previous = selected;
  selected = undefined;
  for (const card of cards.values()) card.button.setAttribute('aria-pressed', 'false');
  renderDetail();
  if (previous && !cards.get(previous).button.hidden) cards.get(previous).button.focus();
});

function renderDetail() {
  $('detail-empty').hidden = !!selected;
  $('detail-content').hidden = !selected;
  $('close-detail').hidden = !selected;
  if (!selected) {
    set('detail-title', 'Agent details');
    return;
  }
  const role = roles[selected];
  const agent = agents().find((item) => item.id === selected) ?? {
    id: selected,
    sessions: [],
    status: 'idle',
  };
  set('detail-title', `${role.name} · details`);
  const fragment = document.createDocumentFragment();
  const identity = node('div', 'detail-identity');
  const title = node('div');
  title.append(node('h3', '', role.name), node('p', '', role.role));
  identity.append(avatar(selected), title);
  fragment.append(identity);
  const meta = node('dl', 'detail-meta');
  function row(label, value) {
    const definition = node('dd');
    definition.append(value instanceof Node ? value : document.createTextNode(String(value)));
    meta.append(node('dt', '', label), definition);
  }
  row('Runtime', badge(agent.status));
  row('Work', latestTask(agent));
  row('Source', sourceLabel(agent.current?.source));
  row('Last seen', timeNode(agent.lastSeen));
  if (agent.current?.feature) row('Feature', agent.current.feature);
  if (agent.current?.handoffTo) row('Handoff', agent.current.handoffTo);
  fragment.append(meta, node('h3', 'detail-heading', 'Reported sessions'));
  const sessions = node('ul', 'session-list detail-sessions');
  for (const session of agent.sessions ?? []) {
    const item = node('li', 'session-item');
    const top = node('div', 'session-top');
    top.append(
      node('strong', '', session.sessionId || session.id || 'Unnamed session'),
      badge(session.status),
    );
    item.append(
      top,
      node('p', '', session.task || session.action || 'No task reported.'),
      node(
        'small',
        '',
        `${sourceLabel(session.source)}${session.feature ? ` · ${session.feature}` : ''}`,
      ),
    );
    if (['active', 'waiting'].includes(session.status) && session.startedAt) {
      const duration = node('small', '', elapsed(session.startedAt));
      duration.dataset.elapsed = session.startedAt;
      item.append(duration);
    }
    const seen = node('small');
    seen.append(timeNode(session.at, 'Last report '));
    item.append(seen);
    if (session.worktree) item.append(node('small', '', `Worktree · ${session.worktree}`));
    if (session.handoffTo) item.append(node('small', '', `Handoff to ${session.handoffTo}`));
    sessions.append(item);
  }
  if (!sessions.children.length)
    sessions.append(node('li', 'empty', 'No runtime sessions reported.'));
  fragment.append(sessions, node('h3', 'detail-heading', 'Task board assignments'));
  const assignments = node('ul', 'assignment-list');
  for (const assignment of assignmentsFor(selected)) {
    const item = node('li', 'assignment-item');
    item.append(
      node('strong', '', assignment.id),
      node('p', '', assignment.title || 'Untitled assignment'),
      node(
        'small',
        '',
        `${assignment.status || 'Status not recorded'} · ${assignment.owner || role.name}`,
      ),
    );
    assignments.append(item);
  }
  if (!assignments.children.length)
    assignments.append(node('li', 'empty', 'No task board assignment.'));
  fragment.append(assignments);
  $('detail-content').replaceChildren(fragment);
}

function renderTimeline() {
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  set('event-count', `${events.length} recent event${events.length === 1 ? '' : 's'}`);
  $('onboarding').hidden = events.length > 0;
  const fragment = document.createDocumentFragment();
  for (const event of events) {
    const id = event.agentId || event.agent;
    const role = roles[id];
    const item = node('li', 'timeline-item');
    item.append(avatar(id));
    const body = node('div', 'event-body');
    const heading = node('div', 'event-heading');
    heading.append(
      node('strong', '', role?.name || id || 'Agent'),
      node('span', 'subtle', role?.role || 'Reported activity'),
      timeNode(event.at),
    );
    body.append(
      heading,
      node('p', 'event-task', event.task || event.action || labels[statusOf(event.status)]),
    );
    if (event.action && event.action !== event.task) body.append(node('p', 'subtle', event.action));
    const meta = node('div', 'event-meta');
    for (const value of [
      sourceLabel(event.source),
      event.kind || event.status,
      event.feature,
      event.handoffTo ? `→ ${event.handoffTo}` : null,
    ])
      if (value) meta.append(node('span', '', value));
    body.append(meta);
    item.append(body);
    fragment.append(item);
  }
  $('timeline').replaceChildren(fragment);
}

function renderProgress() {
  const totals = snapshot.totals ?? {};
  const total = Number(totals.total) || 0;
  const done = Number(totals.done) || 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  set('progress-percent', `${percent}%`);
  set('progress-summary', `${done} of ${total} work items complete`);
  $('project-progress').value = percent;
  set('done-count', done);
  set('progress-count', totals.inProgress ?? 0);
  set('blocked-count', totals.blocked ?? 0);
  const fragment = document.createDocumentFragment();
  for (const item of (Array.isArray(snapshot.next) ? snapshot.next : []).slice(0, 4)) {
    const row = node('li', 'queue-item');
    const info = node('div');
    info.append(node('span', 'queue-title', item.title || 'Untitled feature'));
    const unlocks = Array.isArray(item.unlocks) ? item.unlocks.length : item.unlocks;
    info.append(
      node(
        'small',
        'queue-meta',
        [
          item.priority ? `Priority ${item.priority}` : null,
          unlocks ? `Unlocks ${unlocks} dependent feature${unlocks === 1 ? '' : 's'}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'From generated feature queue',
      ),
    );
    row.append(node('span', 'queue-id', item.id), info);
    fragment.append(row);
  }
  if (!fragment.children.length)
    fragment.append(node('li', 'empty', 'No ready features in the project queue.'));
  $('next-queue').replaceChildren(fragment);
}

function acceptSnapshot(value) {
  if (!value || !Array.isArray(value.agents)) throw new Error('Invalid snapshot');
  snapshot = value;
  renderCollector();
  set(
    'project-name',
    typeof value.project === 'string'
      ? value.project
      : value.project?.name || 'Inventory management system',
  );
  const counts = { active: 0, waiting: 0, completed: 0, other: 0 };
  for (const agent of agents()) {
    if (Object.hasOwn(counts, agent.status)) counts[agent.status] += 1;
    else counts.other += 1;
    const card = cards.get(agent.id);
    if (!card) continue;
    const status = statusOf(agent.status);
    card.status.className = `status-badge status-${status}`;
    card.status.textContent = labels[status];
    card.task.textContent = latestTask(agent);
    card.seen.replaceChildren(
      agent.lastSeen ? timeNode(agent.lastSeen, 'Seen ') : node('span', '', 'No telemetry yet'),
    );
    card.button.setAttribute(
      'aria-label',
      `View ${roles[agent.id].name}, ${roles[agent.id].role}, ${labels[status]}`,
    );
  }
  set('active-count', counts.active);
  set('waiting-count', counts.waiting);
  set('completed-count', counts.completed);
  set('other-count', counts.other);
  $('snapshot-time').replaceChildren(timeNode(value.generatedAt, 'Snapshot '));
  applyFilters();
  renderDetail();
  renderTimeline();
  renderProgress();
  renderStage();
}

function renderCollector() {
  const collector = snapshot?.collector;
  const enabled = collector?.enabled === true;
  const available = enabled && collector.available === true;
  $('collector-dot').classList.toggle('connected', available && !disconnected);
  set(
    'collector-label',
    disconnected
      ? 'Activity collector connection interrupted'
      : !enabled
        ? 'Automatic collector off · explicit reports only'
        : !available
          ? 'Codex activity collector unavailable · explicit reports still work'
          : `Codex activity collector connected · ${collector.sessions ?? 0} workspace sessions`,
  );
  $('collector-seen').replaceChildren(
    collector?.lastEventAt
      ? timeNode(collector.lastEventAt, 'Last activity ')
      : node('span', '', 'Waiting for observed activity'),
  );
}

const stream = new EventSource('/api/events');
stream.onopen = () => {
  connectionVersion += 1;
  setConnection(true);
};
stream.onmessage = (event) => {
  try {
    acceptSnapshot(JSON.parse(event.data));
    setConnection(true);
    connectionVersion += 1;
  } catch {
    setConnection(false);
  }
};
stream.onerror = () => {
  connectionVersion += 1;
  setConnection(false);
};
stream.addEventListener('unavailable', () => {
  connectionVersion += 1;
  setConnection(false);
});
const initialVersion = connectionVersion;
fetch('/api/snapshot', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error('Snapshot unavailable');
    return response.json();
  })
  .then((value) => {
    if (connectionVersion === initialVersion) acceptSnapshot(value);
  })
  .catch(() => {
    if (connectionVersion === initialVersion) setConnection(false);
  });
setInterval(() => {
  for (const element of document.querySelectorAll('[data-time]'))
    element.textContent = (element.dataset.prefix || '') + relative(element.dataset.time);
  for (const element of document.querySelectorAll('[data-elapsed]'))
    element.textContent = elapsed(element.dataset.elapsed);
  if (snapshot && disconnected) {
    const age = Date.now() - (timeValue(snapshot.generatedAt) ?? 0);
    if (age > (snapshot.staleAfterMs || 120000))
      set('connection-label', 'Disconnected · snapshot stale');
  }
}, 1000);
window.addEventListener('pagehide', () => stream.close(), { once: true });
