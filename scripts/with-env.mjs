#!/usr/bin/env node
// Usage: node scripts/with-env.mjs <env-file relative to repo root> <command> [args...]
// Loads the env file into the child process environment (variables already set win), sets
// IMS_ENV_FILE so prisma.config.ts loads the same file, then runs the command. Values are never
// printed. Cross-platform replacement for `VAR=x cmd` in package scripts.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [envFileArg, command, ...args] = process.argv.slice(2);
if (!envFileArg || !command) {
  console.error('Usage: node scripts/with-env.mjs <env-file> <command> [args...]');
  process.exit(2);
}

const envFile = path.resolve(repoRoot, envFileArg);
const env = { ...process.env, IMS_ENV_FILE: envFileArg };
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (env[key] === undefined) env[key] = value;
  }
} else if (!process.env.CI) {
  console.error(`Env file ${envFileArg} not found at the repo root.`);
  process.exit(2);
}

const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
