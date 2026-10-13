// Root ESLint flat config shared by every workspace package.
// Packages run `eslint .` from their own folder; ESLint resolves this file by walking up.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
      '**/src/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tools/agent-dashboard/public/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  // FEAT-001 (R1, AC-3): tenant data is read and written only through TenantPrismaService.
  // The unscoped PrismaService / raw client are allowed in platform code only.
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/database/**',
      'apps/api/src/health/**',
      'apps/api/src/tenancy/tenant-lookup.service.ts',
      'apps/api/src/tenancy/tenant-provisioning.service.ts',
      // FEAT-031: cross-tenant claiming, webhook connection lookup and retention (platform code;
      // every row-level statement still filters tenant_id).
      'apps/api/src/integrations/platform/**',
      'apps/api/src/auth/auth.service.ts',
      'apps/api/src/auth/auth.factory.ts',
      'apps/api/src/auth/bootstrap-owner.ts',
      'apps/api/src/testing/**',
      'apps/api/src/**/*.spec.ts',
      'apps/api/src/**/*.int-spec.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@ims/db',
              importNames: ['createPrismaClient', 'PrismaClient'],
              message:
                'Use TenantPrismaService for tenant data (platform code is allow-listed in eslint.config.mjs).',
            },
          ],
          patterns: [
            {
              group: ['**/prisma.service.js', '**/prisma.service'],
              message:
                'Unscoped PrismaService is platform-only. Use TenantPrismaService for tenant data.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
