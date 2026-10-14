/* Feature board: every feature as a card in the column for where it is in delivery. */
import {
  allFeatures,
  connectProject,
  estimate,
  featureColumn,
  fmt,
  worked,
} from './project-data.js';

const $ = (id) => document.getElementById(id);
const COLUMNS = [
  ['backlog', 'Backlog'],
  ['requirements', 'Requirements'],
  ['building', 'Building'],
  ['qa', 'QA'],
  ['blocked', 'Blocked'],
  ['done', 'Done'],
];
let data = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function card(feature) {
  const element = node('article', 'card');
  element.dataset.feature = feature.id;
  const top = node('div', 'card-top');
  top.append(
    node('span', 'card-id', feature.id),
    node('span', `card-priority p-${feature.priority}`, feature.priority),
  );
  const done = feature.subs.filter((s) => s.status === 'Done').length;
  const bar = node('progress', 'card-bar');
  bar.max = Math.max(feature.subs.length, 1);
  bar.value = done;
  bar.setAttribute('aria-label', `${done} of ${feature.subs.length} sub-features done`);
  const est = feature.subs.reduce((total, sub) => total + estimate(sub), 0);
  const actual = feature.subs.reduce((total, sub) => total + worked(data, sub), 0);
  element.append(
    top,
    node('h4', 'card-title', feature.name),
    bar,
    node(
      'p',
      'card-meta',
      `${done}/${feature.subs.length} done · ${fmt(est)} h${actual > 0 ? ` · ${fmt(actual)} h worked` : ''}`,
    ),
  );
  for (const item of data.live.filter((entry) => entry.feature === feature.id)) {
    const chip = node('span', `card-live live-${item.status}`);
    chip.append(
      node('i', 'live-dot'),
      document.createTextNode(`${item.name}${item.layer ? ` · ${item.layer}` : ''}`),
    );
    element.append(chip);
  }
  return element;
}

function render() {
  if (!data) return;
  const select = $('board-stage');
  if (select.options.length - 1 !== data.stages.length) {
    const current = select.value;
    select.replaceChildren(new Option('All stages', 'all'));
    for (const stage of data.stages) select.append(new Option(stage.name, stage.name));
    select.value = [...select.options].some((o) => o.value === current) ? current : 'all';
  }
  const stage = select.value;
  const features = allFeatures(data).filter(
    (feature) => stage === 'all' || feature.stage === stage,
  );
  const fragment = document.createDocumentFragment();
  for (const [key, label] of COLUMNS) {
    const cards = features.filter((feature) => featureColumn(feature) === key);
    const column = node('section', `column column-${key}`);
    column.setAttribute('aria-label', `${label}, ${cards.length} features`);
    const head = node('header', 'column-head');
    head.append(node('h3', '', label), node('span', 'column-count', cards.length));
    const body = node('div', 'column-body');
    for (const feature of cards) body.append(card(feature));
    if (!cards.length) body.append(node('p', 'column-empty', 'Nothing here'));
    column.append(head, body);
    fragment.append(column);
  }
  $('board').replaceChildren(fragment);
  $('board-total').textContent = `${features.length} features`;
}

$('board-stage').addEventListener('change', render);
connectProject((value) => {
  data = value;
  render();
});
