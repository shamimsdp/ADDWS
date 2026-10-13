import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDirectory, report } from './store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { values, positionals } = parseArgs({
  options: {
    agent: { type: 'string' },
    status: { type: 'string', default: 'active' },
    source: { type: 'string', default: 'codex' },
    session: { type: 'string' },
    task: { type: 'string' },
    action: { type: 'string' },
    feature: { type: 'string' },
    to: { type: 'string' },
    run: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});
if (values.help) {
  console.log(
    'Agent activity reporting\n\nnode tools/agent-dashboard/report.mjs --agent <minhaj|rabbi|shamim|tanvir> --source <codex|claude|manual> --session <stable-id> --status <active|waiting|idle|completed|failed> --feature FEAT-XXX --task "Short summary"\n\nOptional: --action "Latest action" --to <next-agent>\nLong commands: add --run -- <executable> <args> for 15-second heartbeats.\nUse non-sensitive summaries only.',
  );
  process.exit(0);
}
const input = {
  ...values,
  sessionId:
    values.session ??
    process.env.IMS_AGENT_SESSION ??
    (values.run ? randomUUID() : `manual-${values.agent}`),
  handoffTo: values.to,
  cwd: process.cwd(),
};
const directory = dataDirectory(root);
if (values.run && !positionals.length) throw new Error('--run needs a command after --');
if (values.run) input.status = 'active';
await report(directory, input);
if (values.run) {
  const child = spawn(positionals[0], positionals.slice(1), {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  const heartbeat = setInterval(
    () => report(directory, { ...input, status: 'active', kind: 'heartbeat' }).catch(() => {}),
    15_000,
  );
  let settled = false;
  const complete = async (code) => {
    if (settled) return;
    settled = true;
    clearInterval(heartbeat);
    await report(directory, {
      ...input,
      status: code === 0 ? 'completed' : 'failed',
      action: code === 0 ? 'Command completed' : 'Command failed',
    });
    process.exitCode = code ?? 1;
  };
  child.once('error', () => complete(1));
  child.once('exit', complete);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}
