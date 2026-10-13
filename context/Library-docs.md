# Library and provider documentation

Status: core stack selected 2026-10-12 (exact versions to be pinned at scaffolding); provider SDKs not selected.

## Documentation register

| Area | Decision status | Documentation needed before implementation |
|---|---|---|
| Monorepo/tooling | pnpm workspaces + Turborepo | Workspace filters, task pipelines and caching |
| Frontend and UI library | Next.js (App Router) + Tailwind CSS; Playwright E2E | Official version-specific routing, forms, accessibility, localization and build docs |
| Backend/runtime | Node.js + NestJS; Vitest unit tests | Validation, transactions, error handling, background jobs and deployment docs |
| Database/ORM | PostgreSQL on Neon; Prisma ORM | Transactions, locking, constraints, migrations, backup/restore and connection management |
| Authentication | Better Auth (NestJS API, Prisma adapter; React client in Next.js) | Sessions, tenant/role scope, MFA and device access |
| Offline storage/client | Open | Durable local persistence, cache updates, sync and browser/device limitations |
| Ecommerce | One initial provider proposed; selection open | Products/variants, inventory locations, orders, refunds, webhooks, scopes and rate limits |
| Courier | One initial provider proposed; selection open | Booking, labels, tracking, returns, COD settlements and sandbox access |
| Payments | Selection and initial scope open | Merchant onboarding, signatures, callbacks, refunds and reconciliation |
| Printing/scanning | Pilot hardware unknown | Browser/native printing constraints, barcode symbologies and Bangla fonts |
| Tax exports | Applicability open | Current official requirements and reviewed document templates |

## Maintenance rules

Record exact package versions, official documentation URLs, access dates, relevant API contracts and known limitations after selection. Verify current official sources before making provider/library claims. Research marketing pages are discovery material, not integration contracts.

Do not copy the unresolved citation IDs from the deep research report as usable references. Preserve the source documents, but record newly verified evidence separately.

## Pinned versions (FEAT-000)

Versions verified against the npm registry on 2026-10-12. Tool versions are pinned once in the `catalog:` block of `pnpm-workspace.yaml`; packages reference `catalog:`. Rows for NestJS, Prisma, Next.js, Tailwind, Vitest and Playwright were added by FEAT-000.2 to 000.6. pnpm 10.34 build-script allow-list uses the `allowBuilds` map in `pnpm-workspace.yaml` (the current form; pnpm rewrites `onlyBuiltDependencies` into it).

| Tool | Version | Pinned in | Official docs | Notes |
|---|---|---|---|---|
| Node.js | 24.x (local 24.19.0) | `.nvmrc`, root `engines` | https://nodejs.org/docs/latest-v24.x/api/ | |
| pnpm | 10.34.6 | root `packageManager`, `engines` (`>=10 <11`) | https://pnpm.io/workspaces , https://pnpm.io/catalogs | Activated via Corepack. pnpm 10 blocks dependency lifecycle scripts by default: Prisma/Nest native deps need `onlyBuiltDependencies` in `pnpm-workspace.yaml`. |
| Turborepo | 2.11.7 | catalog | https://turborepo.com/docs | Strict env mode: tasks needing env vars (e.g. `DATABASE_URL`) must declare `env`/`passThroughEnv` in `turbo.json`. |
| TypeScript | 6.0.3 | catalog | https://www.typescriptlang.org/tsconfig | 7.0.2 is the latest, but typescript-eslint 8.71 supports `<6.1.0` only. TS 6 defaults `types` to `[]`, so the base config sets `"types": ["node"]`. |
| ESLint | 10.12.0 (+ @eslint/js 10.0.1) | catalog | https://eslint.org/docs/latest/use/configure/configuration-files | Flat config `eslint.config.mjs` at the repo root. |
| typescript-eslint | 8.71.1 | catalog | https://typescript-eslint.io/getting-started/typed-linting | `recommendedTypeChecked` with `projectService`. |
| Prettier | 3.9.10 (+ eslint-config-prettier 10.1.8) | catalog | https://prettier.io/docs/configuration | Single quotes, semicolons, 100 cols, LF. |
| @types/node | 24.19.2 | catalog | https://www.npmjs.com/package/@types/node | Matched to the Node 24 runtime. |
| globals | 17.13.0 | catalog | https://github.com/sindresorhus/globals | |
| Next.js | 16.4.0 (Turbopack) | catalog | https://nextjs.org/docs/app | App Router, `src/` dir. Accessed 2026-10-12. `eslint-config-next` 16.4.0 (same version, catalog); its bundled react/import/jsx-a11y plugins declare peers up to ESLint 9, so pnpm prints unmet-peer warnings with ESLint 10; lint runs correctly. |
| React / React DOM | 19.3.0 (+ @types/react, @types/react-dom 19.3.0) | catalog | https://react.dev/reference/react | Accessed 2026-10-12. |
| Tailwind CSS | 4.3.3 (+ @tailwindcss/postcss 4.3.3) | catalog | https://tailwindcss.com/docs/theme | CSS-first `@theme` in `apps/web/src/app/globals.css`; default palette removed (`--color-*: initial`). Spacing token names (`xs`..`3xl`) shadow `max-w-xl/2xl/3xl`; use `max-w-prose` or add `--container-*` tokens. Accessed 2026-10-12. |
| Playwright | @playwright/test 1.64.0, Chromium headless shell 156.0.8078.4 | catalog | https://playwright.dev/docs/intro | Chromium only. Browser install: `pnpm --filter web exec playwright install chromium` (CI: add `--with-deps`). Accessed 2026-10-12. |
| NestJS | @nestjs/common, core, platform-express, testing 12.1.2; @nestjs/config 12.0.1 | catalog | https://docs.nestjs.com/ , https://docs.nestjs.com/techniques/configuration | Nest 12 packages are ESM-only (`"type": "module"`), so `apps/api` is ESM (`type: module`, NodeNext, `.js` relative imports). Express 5 adapter. Built with `tsc` (no Nest CLI); `emitDecoratorMetadata` required. Accessed 2026-10-12. |
| class-validator / class-transformer / reflect-metadata | 0.15.1 / 0.5.1 / 0.2.2 | catalog | https://github.com/typestack/class-validator | Global ValidationPipe (whitelist, forbidNonWhitelisted, transform) and env validation. Accessed 2026-10-12. |
| nestjs-pino / pino / pino-http / pino-pretty | 5.3.1 / 10.4.0 / 11.0.0 / 13.2.0 (pretty: dev only) | catalog | https://github.com/iamolegga/nestjs-pino , https://getpino.io/#/docs/redaction | Redaction paths + err serializer + logMethod hook scrub credentials. Accessed 2026-10-12. |
| Prisma ORM | prisma, @prisma/client, @prisma/adapter-pg 7.10.0 | catalog | https://www.prisma.io/docs/orm/reference/prisma-config-reference , https://www.prisma.io/docs/orm/overview/databases/neon | Prisma 7: URLs live in `packages/db/prisma.config.ts` (CLI uses `DIRECT_URL`), not in `schema.prisma`; the app uses the `pg` driver adapter with pooled `DATABASE_URL`; `prisma-client` generator emits TS to `src/generated/prisma` (git-ignored, CJS). Prisma 7 does not load `.env` itself (our config does). npm `latest` tag is 8.0.0-rc.22 (pre-release) on 2026-10-12, so 7.10.0 (stable) is pinned. pnpm `allowBuilds`: `prisma`, `@prisma/engines`. Accessed 2026-10-12. |
| Neon | Project `inventory-management-system` (floral-rice-06629946), aws-ap-southeast-1, Postgres 18; branches main/dev/test | `.env`, `.env.test` (git-ignored) | https://neon.com/docs/guides/prisma , https://neon.com/docs/guides/branching-github-actions | `DATABASE_URL` pooled (`-pooler` host, `sslmode=verify-full` to silence the pg sslmode warning), `DIRECT_URL` direct (`sslmode=require`, used by the Prisma schema engine). `current_setting('neon.branch_id')` drives the DB target guards. Accessed 2026-10-12. |
| Vitest | vitest 5.0.3, @vitest/coverage-v8 5.0.3, vite 8.3.4 (peer) | catalog | https://vitest.dev/config/ , https://vitest.dev/guide/coverage | Vitest 5 has `vite` as a non-optional peer, so it is a devDependency. Accessed 2026-10-12. |
| SWC for Vitest | unplugin-swc 2.0.0, @swc/core 1.16.18 | catalog | https://github.com/unplugin/unplugin-swc | Needed in `apps/api` tests: Vite 8 oxc transform does not emit decorator metadata. Plugin disables oxc/esbuild. pnpm `allowBuilds`: `@swc/core`. Accessed 2026-10-12. |
| supertest | 7.3.1 (+ @types/supertest 7.2.1, @types/express 5.0.6) | catalog | https://github.com/ladjs/supertest | HTTP pipeline tests. Accessed 2026-10-12. |
| GitHub Actions | actions/checkout v7, actions/setup-node v7, actions/cache v6, actions/upload-artifact v7, pnpm/action-setup v6, neondatabase/create-branch-action v6, neondatabase/delete-branch-action v3 | `.github/workflows/ci.yml` | https://docs.github.com/actions , https://github.com/neondatabase/create-branch-action | Latest releases checked via GitHub API 2026-10-12. |

## Authentication (FEAT-002, 2026-10-13, Rabbi/Codex)

Pinned through the workspace catalog: `better-auth` **1.7.7**, `nodemailer` **10.1.0**, `@types/nodemailer` **8.0.2**. npm registry and current official docs verified 2026-10-12/13. ESM Nest 12/Express 5, Prisma 7 PostgreSQL adapter and Node 24 are compatible; real-cookie tests run against the actual Neon test branch.

- [Express integration](https://better-auth.com/docs/integrations/express): original `/api/auth` handler before body parsing, credentialed CORS, `toNodeHandler` and `fromNodeHeaders`.
- [Prisma adapter](https://better-auth.com/docs/adapters/prisma): explicit existing Prisma client/driver adapter, generated schema compatibility and separate Prisma migrations.
- [Email/password](https://better-auth.com/docs/authentication/email-password), [sessions](https://better-auth.com/docs/concepts/session-management), [two-factor](https://better-auth.com/docs/plugins/2fa), [organizations](https://better-auth.com/docs/plugins/organization): sessions, email delivery/recovery, TOTP enrollment/challenges/recovery and mapped organizations.
- [Nodemailer SMTP](https://nodemailer.com/smtp): provider-neutral transport with connection/socket timeouts; local capture is application-owned and never publicly served.
- Frontend catalog pin: `react-qr-code` **2.2.0**, checked against its installed package metadata/README on 2026-10-13. The [maintainer documentation](https://github.com/rosskhanas/react-qr-code#readme) describes local SVG generation from `value` and a light container with padding for the quiet zone. MFA setup renders its URI locally; no QR service receives the authenticator secret.

Version-specific source was also checked: TOTP has `verified`, `failedVerificationCount` and `lockedUntil`; password reset and pending MFA challenges consume verification records atomically; backup-code consumption uses a conditional atomic update; signed verification email links need an application one-use guard. The plugin discards a pending sign-in session until MFA succeeds, so after hooks null-check `newSession`. A separate persisted, input-disabled session marker enforces actual second-factor completion; enrollment flags alone are insufficient. Raw organization/signup/membership/user/session mutations are unavailable through the HTTP allowlist; custom scoped transactional access endpoints implement the approved business rules. No cookie cache or trusted-device MFA bypass.

Details and deployed contract: `apps/api/src/auth/README.md` and FEAT-002 Backend handoff. SMTP sender configuration and any future trusted-proxy deployment policy remain explicit operator configuration; no provider account was provisioned. Only the dedicated test branch migration was applied; production/development schema rollout remains a deployment step.

## Job queue and outbox (FEAT-031, decision R1, 2026-10-12, Rabbi)

**Decision: own Postgres implementation on Prisma (raw SQL for claiming), no new dependency.** pg-boss was evaluated and not adopted. Versions: none added (Prisma 7.10.0 / pg adapter as pinned above).

| Check | Own implementation | pg-boss |
|---|---|---|
| Neon pooled connection (PgBouncer `pool_mode=transaction`; unsupported there: LISTEN/NOTIFY, session advisory locks, SET/RESET, SQL-level PREPARE; protocol-level prepared statements work), per https://neon.com/docs/connect/connection-pooling (accessed 2026-10-12) | Works: each claim is one short transaction using a **transaction-level** advisory lock (`pg_advisory_xact_lock`) plus `FOR UPDATE SKIP LOCKED`; nothing session-scoped; verified by the competing-workers and lease tests on the pooled `DATABASE_URL` of the Neon test branch | Relies on SKIP LOCKED (fine) but also offers LISTEN/NOTIFY and runs its own maintenance/migrations on its own pool; those parts need the direct connection or care with the pooler (https://github.com/timgit/pg-boss, accessed 2026-10-12) |
| Transactional enqueue with domain writes | Native: `outbox.enqueue(tx, ...)` / `jobs.enqueue(tx, ...)` use the caller's Prisma transaction | Possible through a DB adapter, but its tables are not Prisma models |
| Tenant column, tenant-context restoration, per-tenant fairness cap (R9) | Built in (tenant_id on every row, per-tenant cap in the claim query) | Not native (would need a queue per tenant or a wrapper) |
| Schema and migrations | Prisma models + one reviewable migration; drift check covers them | Own `pgboss` schema with its own migration CLI next to Prisma (two migration systems) |
| Extra service to host | None | None |

Reversible: callers depend on `OutboxService`, `JobQueueService`, `WorkHandlerRegistry` and `WorkRunner.runDueWork`, not on the storage. Revisit (e.g. pg-boss or a hosted queue) if throughput outgrows one claim transaction at a time (the claim lock serialises claimers for exact per-tenant caps).

**Retry schedule (FEAT-031 FI-1, 2026-10-12, Rabbi; replaces the original full-jitter values).** Defaults: `JOB_BACKOFF_BASE_MS=600000` (10 min), factor 2, `JOB_BACKOFF_CAP_MS=7200000` (2 h), `JOB_MAX_ATTEMPTS=8`, `JOB_BACKOFF_JITTER=0.2`. Each wait is `nominal * (1 - jitter * random)` with a 1 s floor, where `nominal = min(cap, base * 2^(attempt-1))`. The 7 waits between 8 attempts are nominally 600, 1200, 2400, 4800, 7200, 7200 and 7200 s, so 30,600 s (8 h 30 min) with random = 0 and 24,480 s (6 h 48 min) with random = 1, about 7 h 40 min on average. This matches the user's Q1 answer ("about 8 hours"). A provider Retry-After still takes precedence, capped at 24 h. Code: `apps/api/src/integrations/core/backoff.ts`.
