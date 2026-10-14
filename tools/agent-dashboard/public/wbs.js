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

function rollup(subs, columns) {
  const done = subs.filter((s) => s.status === 'Done').length;
  const wrap = node('span', 'wbs-rollup');
  wrap.append(node('span', '', `${done}/${subs.length} done`));
  const bar = node('progress', 'wbs-bar');
  bar.max = Math.max(subs.length, 1);
  bar.value = done;
  bar.setAttribute('aria-label', `${done} of ${subs.length} sub-features done`);
  wrap.append(bar);
  if (columns.some(isAgent)) wrap.append(node('span', '', `Agent ${hours(sum(subs, isAgent))} h`));
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
    row.append(node('td', 'mono', sub.id), node('td', 'name', sub.name));
    for (const value of [sub.status, sub.be, sub.fe, sub.qa]) {
      const cell = node('td');
      cell.append(pill(value));
      row.append(cell);
    }
    row.append(node('td', 'bugs', sub.bugs || '—'));
    for (const column of columns) {
      const value = sub.estimates[column];
      row.append(
        node(
          'td',
          `num ${isHuman(column) ? 'human' : 'agent'}`,
          value === null || value === undefined ? '—' : hours(value),
        ),
      );
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

async function load() {
  try {
    const response = await fetch('/api/wbs', { cache: 'no-store' });
    if (!response.ok) throw new Error('WBS unavailable');
    const value = await response.json();
    if (!Array.isArray(value.stages) || !Array.isArray(value.estimateColumns))
      throw new Error('Invalid WBS');
    const next = JSON.stringify({ ...value, generatedAt: undefined });
    $('wbs-time').textContent = `Updated ${new Date(value.generatedAt).toLocaleTimeString()}`;
    setConnection(true);
    if (next === fingerprint) return;
    fingerprint = next;
    data = value;
    renderTotals();
    render();
  } catch {
    setConnection(false);
  }
}

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
setInterval(load, 5000);
