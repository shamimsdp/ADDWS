import http from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTS,
  currentWork,
  dataDirectory,
  parseProject,
  parseWbs,
  readEvents,
  readLedger,
  runtime,
  STALE_MS,
  timeSummary,
  workflowStatus,
} from './store.mjs';
import { startCodexCollector } from './codex-collector.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
// Optional real photos: public/avatars/<agent>.<ext> replaces the illustrated SVG when present.
const PHOTO_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);
const PHOTO_ROUTE = new RegExp(
  `^/avatars/(${AGENTS.map((a) => a.id).join('|')})\\.(jpg|jpeg|png|webp)$`,
);
async function photoFiles(directory) {
  const found = {};
  try {
    for (const file of await readdir(directory)) {
      const [name, extension] = file.toLowerCase().split('.');
      if (AGENTS.some((a) => a.id === name) && PHOTO_TYPES.has(extension) && !found[name])
        found[name] = extension;
    }
  } catch {
    // No avatar folder means illustrated avatars only.
  }
  return found;
}
const allowedAssets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/wbs', ['wbs.html', 'text/html']],
  ['/dashboard', ['dashboard.html', 'text/html']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript']],
  ['/dashboard.css', ['dashboard.css', 'text/css']],
  ['/board', ['board.html', 'text/html']],
  ['/board.js', ['board.js', 'text/javascript']],
  ['/project-data.js', ['project-data.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/wbs.js', ['wbs.js', 'text/javascript']],
  ['/wbs.css', ['wbs.css', 'text/css']],
  ['/activity.js', ['activity.js', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/theme.css', ['theme.css', 'text/css']],
  ...AGENTS.map((agent) => [
    `/avatars/${agent.id}.svg`,
    [`avatars/${agent.id}.svg`, 'image/svg+xml'],
  ]),
]);

export function createDashboard({
  root = ROOT,
  directory = dataDirectory(root),
  collectCodex = root === ROOT && directory === dataDirectory(root),
  sessionsRoot,
  avatars = path.join(here, 'public', 'avatars'),
} = {}) {
  const collector = collectCodex ? startCodexCollector({ root, directory, sessionsRoot }) : null;
  const clients = new Set();
  const wbsClients = new Set();
  let previous = '';
  let previousWbs = '';
  const optionalRead = async (name) => {
    try {
      return await readFile(path.join(root, 'context', name), 'utf8');
    } catch {
      return '';
    }
  };
  async function snapshot() {
    const [events, progress, board, queue, photos] = await Promise.all([
      readEvents(directory),
      optionalRead('feature-progress-list.md'),
      optionalRead('task-board.md'),
      optionalRead('feature-queue.md'),
      photoFiles(avatars),
    ]);
    const work = currentWork(parseWbs(progress));
    const time = timeSummary(await readLedger(directory));
    return {
      photos,
      work,
      time: { agents: time.agents },
      project: 'Inventory Management System',
      generatedAt: new Date().toISOString(),
      staleAfterMs: STALE_MS,
      collector: { enabled: Boolean(collector), ...collector?.status() },
      agents: runtime(events),
      workflow: workflowStatus(events),
      events: events
        .filter((e) => e.kind !== 'heartbeat' && e.agent !== 'main')
        .slice(-100)
        .reverse(),
      ...parseProject(progress, board, queue),
    };
  }
  async function wbs() {
    const [progress, config] = await Promise.all([
      optionalRead('feature-progress-list.md'),
      optionalRead('delivery-config.json'),
    ]);
    const wbsData = parseWbs(progress, config);
    const work = currentWork(wbsData);
    const events = await readEvents(directory);
    const time = timeSummary(await readLedger(directory));
    // Hours actually worked per sub-feature and layer, and who is working on what right now.
    const actual = Object.fromEntries(
      Object.entries(time.actual).map(([id, layers]) => [
        id,
        Object.fromEntries(
          Object.entries(layers).map(([layer, ms]) => [
            layer,
            Math.round((ms / 3_600_000) * 1000) / 1000,
          ]),
        ),
      ]),
    );
    const live = runtime(events)
      .filter((agent) => ['active', 'waiting'].includes(agent.status))
      .map((agent) => ({
        agent: agent.id,
        name: agent.name,
        status: agent.status,
        layer: work[agent.id]?.layer ?? '',
        feature: work[agent.id]?.feature ?? agent.current?.feature ?? '',
        subs: work[agent.id]?.subs ?? agent.current?.subs ?? [],
        activeMs: time.agents[agent.id]?.current?.activeMs ?? 0,
      }));
    return { generatedAt: new Date().toISOString(), ...wbsData, actual, live };
  }
  // Live elapsed time changes every second; the page ticks it locally, so ignore it when deciding to push.
  const wbsFingerprint = (state) =>
    JSON.stringify({
      ...state,
      generatedAt: undefined,
      live: state.live.map((item) => ({ ...item, activeMs: undefined })),
      actual: Object.fromEntries(
        Object.entries(state.actual).map(([id, layers]) => [
          id,
          Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, Math.round(v * 20) / 20])),
        ]),
      ),
    });
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      res.writeHead(403);
      res.end('Local access only');
      return;
    }
    if (
      req.headers.origin &&
      ![
        `http://${host}`,
        `http://127.0.0.1:${server.address()?.port}`,
        `http://localhost:${server.address()?.port}`,
      ].includes(req.headers.origin)
    ) {
      res.writeHead(403);
      res.end('Origin refused');
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end('Read-only dashboard');
      return;
    }
    try {
      const route = new URL(req.url, 'http://localhost').pathname;
      if (route === '/api/snapshot') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(await snapshot()));
        return;
      }
      if (route === '/api/wbs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(await wbs()));
        return;
      }
      if (route === '/api/wbs-events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        const state = await wbs();
        previousWbs = wbsFingerprint(state);
        res.write(`data: ${JSON.stringify(state)}\n\n`);
        wbsClients.add(res);
        req.on('close', () => wbsClients.delete(res));
        return;
      }
      if (route === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write(`data: ${JSON.stringify(await snapshot())}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      const photo = route.match(PHOTO_ROUTE);
      if (photo) {
        const file = (await photoFiles(avatars))[photo[1]];
        if (file !== photo[2]) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': PHOTO_TYPES.get(file) });
        res.end(await readFile(path.join(avatars, `${photo[1]}.${file}`)));
        return;
      }
      const asset = allowedAssets.get(route);
      if (!asset) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const contents = await readFile(path.join(here, 'public', asset[0]));
      res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
      res.end(contents);
    } catch {
      res.writeHead(500);
      res.end('Dashboard data unavailable');
    }
  });
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || (!clients.size && !wbsClients.size)) return;
    busy = true;
    try {
      if (wbsClients.size) {
        const state = await wbs();
        const fingerprint = wbsFingerprint(state);
        if (fingerprint !== previousWbs) {
          previousWbs = fingerprint;
          for (const client of wbsClients) client.write(`data: ${JSON.stringify(state)}\n\n`);
        } else for (const client of wbsClients) client.write(': keepalive\n\n');
      }
      if (!clients.size) return;
      const state = await snapshot();
      // Working time ticks every second on the page; real changes always arrive with an event.
      const fingerprint = JSON.stringify({ ...state, generatedAt: undefined, time: undefined });
      if (fingerprint !== previous) {
        previous = fingerprint;
        for (const client of clients) client.write(`data: ${JSON.stringify(state)}\n\n`);
      } else for (const client of clients) client.write(': keepalive\n\n');
    } catch {
      for (const client of [...clients, ...wbsClients])
        client.write('event: unavailable\ndata: {}\n\n');
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
  server.on('close', () => {
    clearInterval(timer);
    collector?.close();
  });
  return {
    server,
    snapshot,
    wbs,
    close: () => {
      collector?.close();
      for (const client of [...clients, ...wbsClients]) client.end();
      server.close();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.AGENT_DASHBOARD_PORT ?? 4310);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid dashboard port');
  const dashboard = createDashboard();
  dashboard.server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${port} is occupied. Set AGENT_DASHBOARD_PORT to a free port.`
        : 'Dashboard could not start.',
    );
    process.exitCode = 1;
  });
  dashboard.server.listen(port, '127.0.0.1', () =>
    console.log(`Agent dashboard: http://127.0.0.1:${port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, dashboard.close);
}
