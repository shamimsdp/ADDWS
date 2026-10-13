// Invoked through with-env.mjs .env.test. Verify the exact migration connection before writes.
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  assertDbTarget,
  assertTargetConfig,
  createPrismaClient,
  NEON_BRANCH_ID_SQL,
} from '../packages/db/dist/index.js';

const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/db');
const require = createRequire(path.join(dbRoot, 'package.json'));
const execute = promisify(execFile);

export function redactMigrationOutput(value, env) {
  let output = String(value ?? '');
  for (const connection of [env.DIRECT_URL, env.DATABASE_URL]) {
    if (connection) output = output.split(connection).join('[redacted database URL]');
  }
  return output.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted database URL]');
}

export async function runPrisma(env) {
  const metadata = require('prisma/package.json');
  const cli = path.resolve(
    path.dirname(require.resolve('prisma/package.json')),
    typeof metadata.bin === 'string' ? metadata.bin : metadata.bin.prisma,
  );
  try {
    const result = await execute(process.execPath, [cli, 'migrate', 'deploy'], {
      cwd: dbRoot,
      env,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { code: 0, output: result.stdout + result.stderr };
  } catch (error) {
    // Never print error.message/stack: child-process errors can contain arguments and env details.
    return { code: 1, output: String(error.stdout ?? '') + String(error.stderr ?? '') };
  }
}

export async function deployTestMigrations(
  env,
  { createClient = createPrismaClient, migrate = runPrisma } = {},
) {
  assertTargetConfig(env, ['test']);
  if (!env.DIRECT_URL) throw new Error('DIRECT_URL is required for guarded test migrations.');
  const client = createClient({ connectionString: env.DIRECT_URL });
  try {
    await assertDbTarget(env, ['test'], async () => {
      const rows = await client.$queryRawUnsafe(NEON_BRANCH_ID_SQL);
      return rows[0]?.branch_id ?? null;
    });
  } finally {
    await client.$disconnect();
  }
  // Pin both Prisma datasource variables to the checked URL. Config must never load dev defaults.
  const migrationEnv = {
    ...env,
    DATABASE_URL: env.DIRECT_URL,
    DIRECT_URL: env.DIRECT_URL,
    IMS_ENV_FILE: '.env.test',
  };
  const result = await migrate(migrationEnv);
  return { code: result.code, output: redactMigrationOutput(result.output, migrationEnv) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await deployTestMigrations(process.env);
    if (result.output) process.stdout.write(result.output);
    if (result.code) console.error('Guarded test migration failed. Database URLs are redacted.');
    process.exitCode = result.code;
  } catch {
    console.error(
      'Test migrations refused or failed: verify the test target, branch IDs and direct connection.',
    );
    process.exitCode = 1;
  }
}
