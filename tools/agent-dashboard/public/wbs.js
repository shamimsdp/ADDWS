/* Read-only work breakdown view of context/feature-progress-list.md. Text is always inserted as text. */
const $ = (id) => document.getElementById(id);
const ACTIVE = ['Requirements', 'Backend', 'Frontend', 'QA', 'Bug fix', 'In progress'];
const opened = new Map();
let data;
let fingerprint = '';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
const hours = (value) => (Math.round(value * 100) / 100).toLocaleString('en-US');
const slug = (value) =>
  String(value || 'none')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
const isAgent = (column) => / agent \(h\)$/.test(column);
const isHuman = (column) => / verify \(h\)$/.test(column);
const inReview = (sub) => [sub.be, sub.fe, sub.qa].includes('Review');
const sum = (subs, pick) =>
  subs.reduce(
    (total, sub) =>
      total +
      Object.entries(sub.estimates).reduce(
        (t, [column, value]) => (pick(column) && value ? t + value : t),
        0,
      ),
    0,
  );

function matches(sub, feature) {
  const status = $('status-filter').value;
  const query = $('search').value.trim().toLowerCase();
  if (status === 'open' && sub.status === 'Done') return false;
  if (status === 'active' && !ACTIVE.includes(sub.status)) return false;
  if (status === 'Review' && !inReview(sub)) return false;
  if (!['all', 'open', 'active', 'Review'].includes(status) && sub.status !== status) return false;
  if (!query) return true;
  return [sub.id, sub.name, feature.id, feature.name].some((v) => v.toLowerCase().includes(query));
}

function pill(value) {
  return node('span', `pill pill-${slug(value)}`, value || '—');
}

// Hours actually worked (from the agents' recorded runs) on these sub-features, all layers.
const actualHours = (subs) =>
  subs.reduce(
    (total, sub) => total + Object.values(data?.actual?.[sub.id] ?? {}).reduce((a, b) => a + b, 0),
    0,
  );
const LAYER_OF = { PM: 'PM', BE: 'BE', FE: 'FE', QA: 'QA' };
const layerOf = (column) => LAYER_OF[column.slice(0, 2)] ?? '';
const clock = (ms) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
};
const liveFor = (feature) => (data?.live ?? []).filter((item) => item.feature === feature.id);

function rollup(subs, columns) {
  const done = subs.filter((s) => s.status === 'Done').length;
  const wrap = node('span', 'wbs-rollup');
  wrap.append(node('span', '', `${done}/${subs.length} done`));
  const bar = node('progress', 'wbs-bar');
  bar.max = Math.max(subs.length, 1);
  bar.value = done;
  bar.setAttribute('aria-label', `${done} of ${subs.length} sub-features done`);
  wrap.append(bar);
  if (columns.some(isAgent)) {
    const worked = actualHours(subs);
    wrap.append(
      node(
        'span',
        '',
        `Agent ${hours(sum(subs, isAgent))} h${worked > 0 ? ` · actual ${hours(worked)} h` : ''}`,
      ),
    );
  }
  if (columns.some(isHuman)) wrap.append(node('span', '', `Human ${hours(sum(subs, isHuman))} h`));
  return wrap;
}

function table(feature, subs, columns) {
  const scroller = node('div', 'wbs-scroll');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', `${feature.id} sub-features`);
  const grid = node('table', 'wbs-table');
  const head = node('tr');
  const labels = ['ID', 'Sub-feature', 'Status', 'BE', 'FE', 'QA', 'Bugs'];
  for (const label of labels) head.append(node('th', '', label));
  for (const column of columns)
    head.append(
      node('th', `num ${isHuman(column) ? 'human' : 'agent'}`, column.replace(' (h)', '')),
    );
  head.append(node('th', '', 'Updated'));
  const thead = node('thead');
  thead.append(head);
  const body = node('tbody');
  for (const sub of subs) {
    const row = node('tr');
    row.dataset.sub = sub.id;
    const working = (data?.live ?? []).filter((item) => item.subs.includes(sub.id));
    if (working.length) row.classList.add('is-live');
    row.append(node('td', 'mono', sub.id), node('td', 'name', sub.name));
    for (const value of [sub.status, sub.be, sub.fe, sub.qa]) {
      const cell = node('td');
      cell.append(pill(value));
      row.append(cell);
    }
    row.append(node('td', 'bugs', sub.bugs || '—'));
    for (const column of columns) {
      const value = sub.estimates[column];
      const cell = node(
        'td',
        `num ${isHuman(column) ? 'human' : 'agent'}`,
        value === null || value === undefined ? '—' : hours(value),
      );
      // Agent cells read "estimate / actual" once that layer has recorded working time.
      const worked = isAgent(column) ? data?.actual?.[sub.id]?.[layerOf(column)] : undefined;
      if (worked > 0) {
        cell.append(node('span', 'actual', ` / ${hours(worked)}`));
        cell.title = `Estimated ${hours(value ?? 0)} h · actual ${hours(worked)} h`;
      }
      row.append(cell);
    }
    row.append(node('td', 'updated', sub.updated || '—'));
    body.append(row);
  }
  grid.append(thead, body);
  scroller.append(grid);
  return scroller;
}

function render() {
  if (!data) return;
  const columns = data.estimateColumns;
  const stageFilter = $('stage-filter').value;
  const filtering = $('status-filter').value !== 'all' || $('search').value.trim() !== '';
  const tree = $('wbs-tree');
  const fragment = document.createDocumentFragment();
  let shown = 0;
  for (const stage of data.stages) {
    if (stageFilter !== 'all' && stage.name !== stageFilter) continue;
    const features = stage.features
      .map((feature) => ({ feature, subs: feature.subs.filter((sub) => matches(sub, feature)) }))
      .filter(({ subs }) => subs.length);
    if (!features.length) continue;
    const section = node('section', 'panel wbs-stage');
    const heading = node('div', 'wbs-stage-heading');
    heading.append(
      node('h2', '', stage.name),
      rollup(
        stage.features.flatMap((f) => f.subs),
        columns,
      ),
    );
    section.append(heading);
    for (const { feature, subs } of features) {
      shown += subs.length;
      const details = node('details', 'wbs-feature');
      details.dataset.feature = feature.id;
      const fallback = feature.subs.some((s) => ACTIVE.includes(s.status) || inReview(s));
      details.open = filtering || (opened.get(feature.id) ?? fallback);
      details.addEventListener('toggle', () => {
        if (!filtering) opened.set(feature.id, details.open);
      });
      const summary = node('summary');
      const title = node('span', 'wbs-feature-title');
      title.append(
        node('span', 'mono', feature.id),
        node('strong', '', feature.name),
        pill(feature.priority),
      );
      const live = liveFor(feature);
      for (const item of live) {
        const chip = node('span', `live-chip live-${item.status}`);
        chip.append(
          node('i', 'live-dot'),
          node('span', '', `${item.name} · ${item.layer || 'working'} · `),
        );
        const timer = node('time', '', clock(item.activeMs));
        timer.dataset.liveBase = String(item.status === 'active' ? item.activeMs : '');
        timer.dataset.liveAt = String(Date.now());
        chip.append(timer);
        title.append(chip);
      }
      summary.append(title, rollup(feature.subs, columns));
      details.append(summary, table(feature, subs, columns));
      section.append(details);
    }
    fragment.append(section);
  }
  tree.replaceChildren(fragment);
  $('wbs-empty').hidden = shown > 0;
}

function renderTotals() {
  const subs = data.stages.flatMap((s) => s.features.flatMap((f) => f.subs));
  const open = subs.filter((s) => s.status !== 'Done');
  const human = data.estimateColumns.some(isHuman);
  $('wbs-mode').textContent =
    data.mode === 'fully-agentic' ? 'Fully agentic' : 'Agent + human review';
  $('wbs-done').textContent = `${subs.length - open.length} / ${subs.length}`;
  $('wbs-agent').textContent = `${hours(sum(subs, isAgent))} · ${hours(sum(open, isAgent))}`;
  $('wbs-human-metric').hidden = !human;
  $('wbs-human').textContent = `${hours(sum(subs, isHuman))} · ${hours(sum(open, isHuman))}`;
  const worked = actualHours(subs);
  $('wbs-actual').textContent = `${hours(worked)} h`;
  $('wbs-blocked').textContent =
    `${subs.filter((s) => s.status === 'Blocked').length} · ${subs.filter(inReview).length}`;
  const select = $('stage-filter');
  const current = select.value;
  const options = [node('option', '', 'All stages')];
  options[0].value = 'all';
  for (const stage of data.stages) {
    const option = node('option', '', stage.name);
    option.value = stage.name;
    options.push(option);
  }
  select.replaceChildren(...options);
  select.value = data.stages.some((s) => s.name === current) ? current : 'all';
}

function setConnection(ok) {
  $('connection').classList.toggle('disconnected', !ok);
  $('connection-label').textContent = ok ? 'Live from tracker' : 'Tracker unavailable';
  $('wbs-error').hidden = ok;
}

function accept(value) {
  if (!Array.isArray(value.stages) || !Array.isArray(value.estimateColumns))
    throw new Error('Invalid WBS');
  value.live ??= [];
  value.actual ??= {};
  {
    const next = JSON.stringify({ ...value, generatedAt: undefined });
    $('wbs-time').textContent = `Updated ${new Date(value.generatedAt).toLocaleTimeString()}`;
    setConnection(true);
    if (next === fingerprint) return;
    fingerprint = next;
    data = value;
    renderTotals();
    render();
  }
}

async function load() {
  try {
    const response = await fetch('/api/wbs', { cache: 'no-store' });
    if (!response.ok) throw new Error('WBS unavailable');
    accept(await response.json());
  } catch {
    setConnection(false);
  }
}

// Realtime: the server pushes whenever the tracker, a run or an agent's state changes.
const stream = new EventSource('/api/wbs-events');
stream.onmessage = (event) => {
  try {
    accept(JSON.parse(event.data));
  } catch {
    setConnection(false);
  }
};
stream.onerror = () => setConnection(false);
stream.addEventListener('unavailable', () => setConnection(false));
window.addEventListener('pagehide', () => stream.close(), { once: true });

for (const id of ['stage-filter', 'status-filter']) $(id).addEventListener('change', render);
$('search').addEventListener('input', render);
for (const [id, open] of [
  ['expand-all', true],
  ['collapse-all', false],
]) {
  $(id).addEventListener('click', () => {
    for (const details of document.querySelectorAll('.wbs-feature')) {
      details.open = open;
      opened.set(details.dataset.feature, open);
    }
  });
}
load();
// Slow safety net in case the stream drops silently; live timers tick locally every second.
setInterval(load, 30000);
setInterval(() => {
  for (const timer of document.querySelectorAll('time[data-live-base]'))
    if (timer.dataset.liveBase)
      timer.textContent = clock(
        Number(timer.dataset.liveBase) + Date.now() - Number(timer.dataset.liveAt),
      );
}, 1000);
