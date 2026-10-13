import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deployTestMigrations, redactMigrationOutput } from './deploy-test-migrations.mjs';

const env = {
  NODE_ENV: 'test',
  DB_TARGET: 'test',
  NEON_BRANCH_ID: 'br-test',
  NEON_MAIN_BRANCH_ID: 'br-main',
  DIRECT_URL: 'postgresql://fictional:test@example.invalid/test',
  DATABASE_URL: 'postgresql://fictional:dev@example.invalid/dev',
};

test('test migration refuses unsafe configuration before connecting or writing', async () => {
  for (const invalid of [
    { DB_TARGET: 'dev' },
    { NODE_ENV: 'production' },
    { NEON_MAIN_BRANCH_ID: '' },
    { NEON_BRANCH_ID: 'br-main' },
    { DIRECT_URL: '' },
  ]) {
    await assert.rejects(
      deployTestMigrations(
        { ...env, ...invalid },
        {
          createClient: () => assert.fail('must not connect'),
          migrate: () => assert.fail('must not migrate'),
        },
      ),
    );
  }
});

test('test migration checks direct database identity and disconnects on mismatch', async () => {
  for (const actual of ['br-main', 'br-other', null]) {
    let disconnected = false;
    await assert.rejects(
      deployTestMigrations(env, {
        createClient: ({ connectionString }) => {
          assert.equal(connectionString, env.DIRECT_URL);
          return {
            $queryRawUnsafe: async () => [{ branch_id: actual }],
            $disconnect: async () => {
              disconnected = true;
            },
          };
        },
        migrate: () => assert.fail('must not migrate'),
      }),
    );
    assert.equal(disconnected, true);
  }
});

test('test migration only runs after identity verification and pins the verified datasource', async () => {
  let disconnected = false;
  const result = await deployTestMigrations(env, {
    createClient: () => ({
      $queryRawUnsafe: async () => [{ branch_id: 'br-test' }],
      $disconnect: async () => {
        disconnected = true;
      },
    }),
    migrate: async (childEnv) => {
      assert.equal(disconnected, true);
      assert.equal(childEnv.DATABASE_URL, env.DIRECT_URL);
      assert.equal(childEnv.DIRECT_URL, env.DIRECT_URL);
      assert.equal(childEnv.IMS_ENV_FILE, '.env.test');
      return { code: 1, output: `Failure at ${env.DIRECT_URL}` };
    },
  });
  assert.equal(result.code, 1);
  assert.equal(result.output, 'Failure at [redacted database URL]');
  assert.equal(
    redactMigrationOutput(`Unknown postgresql://another:credential@host/db`, env),
    'Unknown [redacted database URL]',
  );
});
