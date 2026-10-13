import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, dataDirectory, parseProject, readEvents, runtime, STALE_MS } from './store.mjs';
import { startCodexCollector } from './codex-collector.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
const allowedAssets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/activity.js', ['activity.js', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
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
} = {}) {
  const collector = collectCodex ? startCodexCollector({ root, directory, sessionsRoot }) : null;
  const clients = new Set();
  let previous = '';
  const optionalRead = async (name) => {
    try {
      return await readFile(path.join(root, 'context', name), 'utf8');
    } catch {
      return '';
    }
  };
  async function snapshot() {
    const [events, progress, board, queue] = await Promise.all([
      readEvents(directory),
      optionalRead('feature-progress-list.md'),
      optionalRead('task-board.md'),
      optionalRead('feature-queue.md'),
    ]);
    return {
      project: 'Inventory Management System',
      generatedAt: new Date().toISOString(),
      staleAfterMs: STALE_MS,
      collector: { enabled: Boolean(collector), ...collector?.status() },
      agents: runtime(events),
      events: events
        .filter((e) => e.kind !== 'heartbeat')
        .slice(-100)
        .reverse(),
      ...parseProject(progress, board, queue),
    };
  }
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
    if (busy || !clients.size) return;
    busy = true;
    try {
      const state = await snapshot();
      const fingerprint = JSON.stringify({ ...state, generatedAt: undefined });
      if (fingerprint !== previous) {
        previous = fingerprint;
        for (const client of clients) client.write(`data: ${JSON.stringify(state)}\n\n`);
      } else for (const client of clients) client.write(': keepalive\n\n');
    } catch {
      for (const client of clients) client.write('event: unavailable\ndata: {}\n\n');
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
    close: () => {
      collector?.close();
      for (const client of clients) client.end();
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
