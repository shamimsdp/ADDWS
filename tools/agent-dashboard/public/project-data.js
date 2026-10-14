/* Shared project data for the dashboard and the feature board: derived state and the live stream. */
export const ACTIVE = ['Requirements', 'Backend', 'Frontend', 'QA', 'Bug fix'];
export const MODES = {
  'fully-agentic': 'Fully agentic',
  'agent-human-review': 'Agent + human review',
};

export const isAgentColumn = (column) => / agent \(h\)$/.test(column);
export const isP1 = (sub) => /\(P1\)/.test(sub.name);

export const subState = (sub) =>
  sub.status === 'Done'
    ? 'done'
    : sub.status === 'Blocked'
      ? 'blocked'
      : ACTIVE.includes(sub.status) || [sub.be, sub.fe, sub.qa].includes('In progress')
        ? 'active'
        : 'todo';

// Estimated agent hours for a sub-feature, all layers.
export const estimate = (sub) =>
  Object.entries(sub.estimates ?? {}).reduce(
    (total, [column, value]) => (isAgentColumn(column) && value ? total + value : total),
    0,
  );
// Agent hours actually worked on a sub-feature, all layers.
export const worked = (data, sub) =>
  Object.values(data.actual?.[sub.id] ?? {}).reduce((a, b) => a + b, 0);

export function featureColumn(feature) {
  // A P0 feature is done once its core (non-P1) sub-features are; P1 extras do not hold it back.
  const core = feature.priority === 'P0' ? feature.subs.filter((s) => !isP1(s)) : feature.subs;
  if (core.length && core.every((s) => s.status === 'Done')) return 'done';
  const subs = feature.subs;
  const layerBusy = (key) => subs.some((s) => s[key] === 'In progress');
  if (
    subs.some((s) => ['Backend', 'Frontend', 'Bug fix'].includes(s.status)) ||
    layerBusy('be') ||
    layerBusy('fe')
  )
    return 'building';
  if (subs.some((s) => s.status === 'QA') || layerBusy('qa')) return 'qa';
  if (subs.some((s) => s.status === 'Requirements')) return 'requirements';
  const open = subs.filter((s) => s.status !== 'Done');
  if (open.length && open.every((s) => s.status === 'Blocked')) return 'blocked';
  return 'backlog';
}

export const allFeatures = (data) =>
  data.stages.flatMap((stage) =>
    stage.features.map((feature) => ({ ...feature, stage: stage.name })),
  );

export const round = (value) => Math.round(value * 100) / 100;
export const fmt = (value) => round(value).toLocaleString('en-US');

// Calls onData with each tracker state: now, whenever the server pushes, and on a slow safety poll.
export function connectProject(onData) {
  const accept = (value) => {
    if (!Array.isArray(value.stages) || !Array.isArray(value.estimateColumns))
      throw new Error('Invalid WBS');
    value.live ??= [];
    value.actual ??= {};
    onData(value);
  };
  const load = async () => {
    try {
      const response = await fetch('/api/wbs', { cache: 'no-store' });
      if (response.ok) accept(await response.json());
    } catch {
      // The live stream retries on its own.
    }
  };
  const stream = new EventSource('/api/wbs-events');
  stream.onmessage = (event) => {
    try {
      accept(JSON.parse(event.data));
    } catch {
      // Ignore one bad frame; the next push replaces it.
    }
  };
  window.addEventListener('pagehide', () => stream.close(), { once: true });
  load();
  setInterval(load, 30000);
}
