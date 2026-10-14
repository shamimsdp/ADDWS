/* Project dashboard: KPIs and charts. Read-only; all text is inserted as text. */
import {
  MODES,
  allFeatures,
  connectProject,
  estimate,
  featureColumn,
  fmt,
  subState,
  worked,
} from './project-data.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const AGENT_NAMES = { minhaj: 'Minhaj', rabbi: 'Rabbi', shamim: 'Shamim', tanvir: 'Tanvir' };
const AGENT_COLORS = {
  minhaj: '#a78bfa',
  rabbi: '#38bdf8',
  shamim: '#fb923c',
  tanvir: '#34d399',
};
let data = null;
let snapshot = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
function svg(tag, attributes = {}) {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}
function duration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
}

// ---------- KPIs ----------
function renderKpis() {
  const features = allFeatures(data);
  const subs = features.flatMap((f) => f.subs);
  const counts = { done: 0, active: 0, blocked: 0, todo: 0 };
  for (const sub of subs) counts[subState(sub)] += 1;
  const columns = features.map(featureColumn);
  const est = subs.reduce((total, sub) => total + estimate(sub), 0);
  const actual = subs.reduce((total, sub) => total + worked(data, sub), 0);
  const percent = subs.length ? Math.round((counts.done / subs.length) * 100) : 0;
  $('kpi-percent').textContent = `${percent}%`;
  $('kpi-done').textContent = `${counts.done} of ${subs.length} sub-features done`;
  $('kpi-active').textContent = counts.active;
  $('kpi-blocked').textContent = counts.blocked;
  $('kpi-features').textContent =
    `${columns.filter((c) => c === 'done').length} / ${features.length}`;
  $('kpi-features-detail').textContent =
    `${columns.filter((c) => c === 'building' || c === 'qa').length} building or in QA`;
  $('kpi-hours').textContent = `${fmt(est)} h`;
  $('kpi-hours-detail').textContent = `${fmt(actual)} h worked so far`;
  const live = data.live.filter((item) => item.status === 'active');
  $('kpi-working').textContent = live.length;
  $('kpi-working-detail').textContent = live.length
    ? live.map((item) => `${item.name}${item.feature ? ` · ${item.feature}` : ''}`).join(', ')
    : 'no agent active';
  $('mode-chip').textContent = MODES[data.mode] ?? data.mode;
  return { counts, subs };
}

// ---------- charts ----------
function renderStatusChart(counts, total) {
  const parts = [
    ['Done', counts.done, 'var(--c-done)'],
    ['In progress', counts.active, 'var(--c-active)'],
    ['Blocked', counts.blocked, 'var(--c-blocked)'],
    ['Not started', counts.todo, 'var(--c-todo)'],
  ];
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const chart = svg('svg', { viewBox: '0 0 120 120', class: 'donut', role: 'img' });
  chart.setAttribute('aria-label', parts.map(([label, value]) => `${label} ${value}`).join(', '));
  chart.append(svg('circle', { cx: 60, cy: 60, r: radius, class: 'donut-track' }));
  let offset = 0;
  for (const [, value, color] of parts) {
    if (!value) continue;
    const length = (value / total) * circumference;
    const arc = svg('circle', {
      cx: 60,
      cy: 60,
      r: radius,
      class: 'donut-arc',
      'stroke-dasharray': `${length} ${circumference - length}`,
      'stroke-dashoffset': -offset,
      transform: 'rotate(-90 60 60)',
    });
    arc.style.stroke = color;
    chart.append(arc);
    offset += length;
  }
  const center = svg('text', { x: 60, y: 62, class: 'donut-center', 'text-anchor': 'middle' });
  center.textContent = `${total ? Math.round((counts.done / total) * 100) : 0}%`;
  const caption = svg('text', { x: 60, y: 76, class: 'donut-caption', 'text-anchor': 'middle' });
  caption.textContent = 'done';
  chart.append(center, caption);
  const legend = node('ul', 'legend');
  for (const [label, value, color] of parts) {
    const item = node('li');
    const swatch = node('i', 'swatch');
    swatch.style.background = color;
    item.append(swatch, node('span', '', label), node('strong', '', value));
    legend.append(item);
  }
  $('chart-status').replaceChildren(chart, legend);
}
function renderStageChart() {
  const list = node('div', 'stage-bars');
  for (const stage of data.stages) {
    const subs = stage.features.flatMap((f) => f.subs);
    const counts = { done: 0, active: 0, blocked: 0, todo: 0 };
    for (const sub of subs) counts[subState(sub)] += 1;
    const row = node('div', 'stage-row');
    const label = node('span', 'stage-label', stage.name.replace(/^Stage \d+ — /, ''));
    label.title = stage.name;
    const track = node('div', 'stack');
    track.setAttribute('role', 'img');
    track.setAttribute(
      'aria-label',
      `${stage.name}: ${counts.done} done, ${counts.active} in progress, ${counts.blocked} blocked, ${counts.todo} not started`,
    );
    for (const key of ['done', 'active', 'blocked', 'todo']) {
      if (!counts[key]) continue;
      const part = node('i', `stack-${key}`);
      part.style.width = `${(counts[key] / subs.length) * 100}%`;
      track.append(part);
    }
    row.append(label, track, node('span', 'stage-count', `${counts.done}/${subs.length}`));
    list.append(row);
  }
  $('chart-stages').replaceChildren(list);
}
function renderHoursChart() {
  const rows = allFeatures(data)
    .map((feature) => ({
      feature,
      est: feature.subs.reduce((total, sub) => total + estimate(sub), 0),
      actual: feature.subs.reduce((total, sub) => total + worked(data, sub), 0),
    }))
    .filter((row) => row.est > 0);
  const withWork = rows.filter((row) => row.actual > 0).sort((a, b) => b.actual - a.actual);
  const shown = (withWork.length ? withWork : rows.sort((a, b) => b.est - a.est)).slice(0, 7);
  if (!shown.length) {
    $('chart-hours').replaceChildren(node('p', 'chart-empty', 'No estimates yet.'));
    return;
  }
  const max = Math.max(...shown.map((row) => row.est), ...shown.map((row) => row.actual));
  const list = node('div', 'hour-bars');
  for (const { feature, est, actual } of shown) {
    const row = node('div', 'hour-row');
    const label = node('span', 'hour-label', `${feature.id} ${feature.name}`);
    label.title = `${feature.id} ${feature.name}`;
    const track = node('div', 'hour-track');
    const planned = node('i', 'hour-est');
    planned.style.width = `${(est / max) * 100}%`;
    const done = node('i', 'hour-actual');
    done.style.width = `${Math.max((actual / max) * 100, actual > 0 ? 1.5 : 0)}%`;
    track.append(planned, done);
    track.setAttribute('role', 'img');
    track.setAttribute(
      'aria-label',
      `${feature.name}: ${fmt(est)} hours estimated, ${fmt(actual)} worked`,
    );
    row.append(label, track, node('span', 'hour-value', `${fmt(actual)} / ${fmt(est)} h`));
    list.append(row);
  }
  const key = node('p', 'chart-key');
  key.append(
    node('i', 'swatch swatch-est'),
    document.createTextNode('Estimated '),
    node('i', 'swatch swatch-actual'),
    document.createTextNode('Worked'),
  );
  $('chart-hours').replaceChildren(list, key);
}
function renderAgentChart() {
  const agents = snapshot?.time?.agents ?? {};
  const rows = Object.keys(AGENT_NAMES).map((id) => ({ id, time: agents[id] }));
  const max = Math.max(...rows.map((row) => row.time?.totalWallMs ?? 0), 1);
  if (!rows.some((row) => row.time?.runs)) {
    $('chart-agents').replaceChildren(node('p', 'chart-empty', 'No agent runs recorded yet.'));
    return;
  }
  const list = node('div', 'agent-bars');
  for (const { id, time } of rows) {
    const row = node('div', 'agent-row');
    const track = node('div', 'agent-track');
    const fill = node('i', 'agent-fill');
    fill.style.width = `${((time?.totalWallMs ?? 0) / max) * 100}%`;
    fill.style.background = AGENT_COLORS[id];
    track.append(fill);
    const tokens = time?.tokens?.output
      ? ` · ${Math.round(time.tokens.output / 100) / 10}k tokens out`
      : '';
    row.append(
      node('span', 'agent-label', AGENT_NAMES[id]),
      track,
      node(
        'span',
        'agent-value',
        time?.runs
          ? `${duration(time.totalWallMs)} · ${time.runs} run${time.runs === 1 ? '' : 's'}${tokens}`
          : '—',
      ),
    );
    list.append(row);
  }
  $('chart-agents').replaceChildren(list);
}

function render() {
  if (!data) return;
  const { counts, subs } = renderKpis();
  renderStatusChart(counts, subs.length);
  renderStageChart();
  renderHoursChart();
  renderAgentChart();
}

window.addEventListener('dashboard:snapshot', (event) => {
  snapshot = event.detail;
  if (data) {
    renderAgentChart();
    $('kpi-working').textContent = data.live.filter((item) => item.status === 'active').length;
  }
});
connectProject((value) => {
  data = value;
  render();
});
