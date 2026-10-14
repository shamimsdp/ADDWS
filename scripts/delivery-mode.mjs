#!/usr/bin/env node
// Shows or switches the delivery mode and aligns the estimate columns in
// context/feature-progress-list.md with it.
// Usage:
//   node scripts/delivery-mode.mjs                       show current mode
//   node scripts/delivery-mode.mjs agent-human-review    agents build, humans review/verify
//   node scripts/delivery-mode.mjs fully-agentic         agents only (drops verify columns)
//   node scripts/delivery-mode.mjs --sync                re-align columns, fill missing estimates
//   node scripts/delivery-mode.mjs --sync --file <path> [--mode <mode>]   rewrite another copy

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configPath, MODES, readConfig, rewriteProgress, root } from './delivery.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter(
  (a, i) => !a.startsWith('--') && !['--file', '--mode'].includes(args[i - 1]),
);
const requested = positional[0];
const target = requested ?? option('--mode');
if (positional.length > 1 || (target !== undefined && !MODES.includes(target))) {
  console.error(`Unknown mode "${positional[1] ?? target}". Use one of: ${MODES.join(', ')}`);
  process.exit(1);
}

const config = readConfig();
if (!requested && !args.includes('--sync')) {
  console.log(`Delivery mode: ${config.mode} (estimates in ${config.estimateUnit})`);
  process.exit(0);
}

const mode = target ?? config.mode;
if (requested && requested !== config.mode) {
  writeFileSync(configPath, `${JSON.stringify({ ...config, mode }, null, 2)}\n`);
  console.log(`Delivery mode set to ${mode}`);
}

const file = option('--file') ?? join(root, 'context', 'feature-progress-list.md');
const src = readFileSync(file, 'utf8');
const { text, dropped } = rewriteProgress(src, mode);
if (text !== src) writeFileSync(file, text);
console.log(`Estimate columns aligned to ${mode} in ${file}`);
if (dropped.length)
  console.log(`Removed columns (recoverable from git history): ${dropped.join(', ')}`);
