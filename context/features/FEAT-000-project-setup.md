# FEAT-000: Project setup

Status: Done

## Requirement review (Minhaj)

**Sub-features:** FEAT-000.1 Monorepo scaffold, FEAT-000.2 NestJS API skeleton, FEAT-000.3 Prisma + Neon setup, FEAT-000.4 Vitest setup, FEAT-000.5 Next.js web skeleton, FEAT-000.6 Playwright setup, FEAT-000.7 CI pipeline

**Dependencies done:** None required. FEAT-000 has `Depends on: —` in `feature-list.md`. It is the root of the dependency graph and unlocks all 45 other features.

**Sources checked:**
- `context/feature-list.md` (FEAT-000 section and sub-feature notes), `feature-progress-list.md`, `feature-queue.md` (FEAT-000 ranked #1, unlocks 45, no blocked sub-features)
- `context/architecture.md` (modular monolith, one transactional Postgres, tenant/location scope, UTC plus business timezone)
- `context/code-standards.md` (structured errors, correlation IDs, redacted logs, exact decimal money, UTC instants, reviewable migrations, lint/type/build checks to be established once stack chosen)
- `context/project-rules.md` (rule 12 codebase-memory MCP, rule 13 no secrets in source/fixtures/docs, rule 14 proportionate verification)
- `context/Library-docs.md` (stack chosen; exact versions to be pinned at scaffolding; record versions, doc URLs and access dates)
- `context/ui-tokens.md` (proposed tokens to map into Tailwind; dark mode undecided; Bangla font coverage to verify), `context/ui-rules.md` (no hard-coded text for English/Bangla and BDT, explicit states, accessibility)
- `context/build-plan.md` stage 2 (migrations, audit, CI, basic deployment), `context/workflow.md`, `context/progress-tracker.md` (stack decision and D-01 Better Auth recorded 2026-10-12)
- `CLAUDE.md` and `.claude/agents/*.md` (command conventions: `pnpm --filter api test|lint|build`, `pnpm --filter db prisma migrate dev`, `pnpm --filter web test:e2e`, `pnpm turbo run lint build test`; `.env.test` and a dedicated Neon test branch; pooled `DATABASE_URL` plus direct `DIRECT_URL`; Playwright in `apps/web/e2e/` with QA specs in `apps/web/e2e/qa/`; shared DTO types in `packages/shared`; Better Auth runs inside the NestJS API)
- Repository state: not a git repository, no code, no `package.json`; only `scripts/feature-queue.mjs`. Node 24 available; Python not installed.
- Research documents at repo root: not needed (no product behaviour in this feature).

**Gap checklist:**
- [x] User roles and permissions: N/A for product roles (no users until FEAT-002). `GET /health` is public and exposes no tenant data or secrets. Better Auth is not installed here.
- [x] Business rules and policies: N/A (no business behaviour). Only engineering policies apply: strict TypeScript, no secrets committed (project rule 13), DB-backed tests never run against production or the shared dev branch. See R1-R15.
- [x] Data fields, validation, uniqueness: Mostly N/A. No domain tables in FEAT-000 (baseline migration is empty; domain models start in FEAT-002+). In scope: env var schema validation (R4). Money (Decimal) and opaque-ID conventions from `code-standards.md` apply from the first real model.
- [x] States and transitions: N/A (no entity lifecycle). Only health states ok / not ready are defined (R7).
- [x] Failure, edge and concurrency cases: Covered by R4 (missing or invalid env fails fast at boot without printing values), R6 (global exception filter, no stack leaks), R7 (DB down gives 503 on readiness, process stays up), R9 (integration tests abort unless pointed at the test branch), R12 (CI fails on migration drift; no secret leaks; no secrets for fork PRs). Concurrency tests N/A until inventory features.
- [x] Tenant and location scope: N/A (no tenant data). Setup obligation: the request context (R5) must allow tenant and user to be attached later without rework. Tenancy model is FEAT-002.
- [x] Money / tax / timezone rules: N/A for logic. Obligations: API and tests run with `TZ=UTC`, instants stored as UTC, business timezone is a later tenant setting (Asia/Dhaka expected), Decimal-only money noted in the Prisma setup, web has an i18n-ready string structure (R10).
- [x] Audit needs: N/A (audit is a separate feature). Obligation: structured logs with correlation ID and redaction (R5) so a later audit module can reuse the request context.
- [x] UI screens and flows: One base layout, a placeholder home page and a status indicator proving the typed API client works. Tailwind theme maps `ui-tokens.md` to semantic names (R10). Real screens start in FEAT-002. Register any reusable base primitive in `ui-registry.md`.
- [x] Integrations: Neon (Postgres and branches), git host and CI provider (questions U1-U3). No ecommerce, courier or payment work.
- [x] Open decisions (D-xx): none block FEAT-000 (no Blocked sub-features). The open items below are setup choices outside the D-xx register, because they are not product policies.

**Gaps found:**

Routine, reversible, implementation-level (decided by Minhaj):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | Monorepo layout | Routine | `apps/api`, `apps/web`, `packages/db`, `packages/shared` as in `CLAUDE.md`; `pnpm-workspace.yaml`; root `turbo.json` with `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:*` tasks. Root-level shared configs first; split into `packages/config` only if duplication appears. | As proposed. Reason: matches agent command conventions; easy to reshape. | Minhaj |
| R2 | TypeScript, lint and format strictness | Routine | `strict: true` plus `noUncheckedIndexedAccess`; ESLint flat config with typescript-eslint; Prettier (single quotes, semicolons, 100 cols); EditorConfig; `format:check` in CI. | As proposed. Reason: spec says "TS strict, ESLint, Prettier"; extra flags are cheap now, costly later. | Minhaj |
| R3 | API request validation | Routine | Global `ValidationPipe` with class-validator + class-transformer (`whitelist`, `forbidNonWhitelisted`, `transform`). Types the web needs live in `packages/shared` as plain TS types with no Nest dependency. | As proposed. Reason: agent file allows class-validator or Zod; one global pipe is the specified item. | Minhaj |
| R4 | Env/config handling | Routine | Nest `ConfigModule` with schema validation at boot (fail fast, never print values). Committed `.env.example` with placeholders only; `.env`, `.env.test`, `.env.local` git-ignored. API vars: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `NODE_ENV`, `PORT`, `WEB_ORIGIN`, `LOG_LEVEL`. Web: `NEXT_PUBLIC_API_URL`. `BETTER_AUTH_*` added in FEAT-002. | As proposed. Reason: project rule 13; agent rules already mandate the pooled/direct split. | Minhaj |
| R5 | Logging and correlation IDs | Routine | `nestjs-pino` structured JSON (pretty in dev). Accept inbound `x-request-id` else generate UUID; echo in response header, every log line and every error body. Redact authorization, cookies, passwords, tokens, connection strings. AsyncLocalStorage request context ready for tenant/user. | As proposed. Reason: `code-standards.md` requires structured errors, correlation IDs and redacted logs. | Minhaj |
| R6 | Error response shape | Routine | `{ statusCode, code, message, details?, correlationId }` from a global exception filter; validation errors list field and message; 5xx never leak stack or internals. Type lives in `packages/shared`. | As proposed. Reason: one contract for the web client; cheap to change before real endpoints exist. | Minhaj |
| R7 | Health endpoints | Routine | `GET /health` (liveness, 200 while process is up) and `GET /health/ready` (readiness, `SELECT 1` via Prisma, 503 if DB unreachable). Public; returns only status and uptime. | As proposed. Reason: works for any future deployment target; minimal surface. | Minhaj |
| R8 | Prisma baseline | Routine | `packages/db` exports a client factory and generated client. `schema.prisma` uses `url` = `DATABASE_URL` and `directUrl` = `DIRECT_URL`; one empty baseline migration so `migrate deploy` and the CI drift check have something to run. Scripts `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:status`, `db:seed`. Seed is idempotent and refuses to run when `NODE_ENV=production` or the target is not an allowed dev/test branch. Prisma major pinned at scaffold time after checking current docs; recorded in `Library-docs.md`. | As proposed. Reason: `Library-docs.md` requires pinned, verified versions; domain schema belongs to later features. | Minhaj |
| R9 | Vitest | Routine | Vitest in `apps/api` (`*.spec.ts` beside source) and `packages/shared`/`packages/db` where useful. Two configs: `unit` (Prisma mocked, no network) and `integration` (`.env.test` Neon test branch, serial, aborts unless the connection target is the test branch). V8 coverage reporting, no threshold yet (set once real code exists). Scripts `test`, `test:unit`, `test:integration`, `test:coverage`. | As proposed. Reason: matches agent files. | Minhaj |
| R10 | Next.js and Tailwind | Routine | App Router, TypeScript strict, `src/` dir. Tailwind (current stable at scaffold) with `ui-tokens.md` mapped to semantic theme tokens through CSS variables; no raw hex in components. Light mode only (dark mode undecided). Base layout with skip link, visible focus and landmarks. English-only strings behind an i18n-ready structure. System font stack now; Bangla-capable webfont chosen in a later UI feature. Typed fetch wrapper importing types from `packages/shared`, using `NEXT_PUBLIC_API_URL` and the R6 error shape. | As proposed. Reason: tokens are "proposed starting values"; theme mapping is reversible; font needs print/Bangla verification not needed at setup. | Minhaj |
| R11 | Playwright | Routine | `apps/web/e2e/` plus `e2e/qa/` for Tanvir; `playwright.config.ts` with `webServer` for web and API; Chromium only at first; trace/screenshot on first retry; `test:e2e` script. One smoke spec: home loads and shows API health. Seeding hook in global setup calls the guarded seed against the test branch. No auth fixtures yet. | As proposed. Reason: minimal harness; extra browsers added when POS/devices justify. | Minhaj |
| R12 | CI content (provider-independent) | Routine | On every push and PR: frozen-lockfile install with cache, `format:check`, `lint`, `typecheck`, `build`, unit tests with coverage, `prisma migrate deploy` plus drift check on a Neon test/child branch, e2e job. Turborepo cache on. Secrets only from the CI secret store, never echoed; not exposed to fork PRs. Workflow file format depends on U2. | As proposed. Reason: FEAT-000.7 spec and `build-plan.md` stage 2. | Minhaj |
| R13 | Developer commands and docs | Routine | Root scripts `dev`, `build`, `lint`, `typecheck`, `format`, `test`, `test:e2e`, `db:*`. No README created unless requested; setup notes, versions, doc URLs and access dates go to `context/Library-docs.md`. | As proposed. Reason: repo documentation rules. | Minhaj |
| R14 | Ports, CORS, timezone | Routine | API `:3001`, web `:3000` (configurable); CORS limited to `WEB_ORIGIN`; `TZ=UTC` for API and tests. | As proposed. Reason: conventional, trivially changed. | Minhaj |
| R15 | Neon branch naming and use | Routine | Branches `main` (production; never used by dev or tests), `dev` (shared development), `test` (automated DB-backed tests, resettable). CI migration check uses a short-lived child branch of `test` where possible. | As proposed. Reason: stated in FEAT-000.3 notes. Whether they already exist is U3. | Minhaj |

Needed the user (answered 2026-10-12):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| U1 | Initialise git now? Git host and remote | Business | Run `git init` on `main` now with a `.gitignore`; GitHub private repo | Yes. `git init` now on `main` with `.gitignore`; private GitHub repo. User creates/provides the remote; no push in FEAT-000 unless the user supplies the URL. | User, 2026-10-12 |
| U2 | CI provider | Business | GitHub Actions (assumes U1 = GitHub) | GitHub Actions. | User, 2026-10-12 |
| U3 | Neon project and `main`/`dev`/`test` branches: exist already? Region? Who creates them | Business | User creates project and branches (or asks Minhaj/Rabbi to via Neon tooling) and puts `dev`/`test` URLs only in git-ignored env files | Rabbi creates the Neon project and `main`/`dev`/`test` branches via Neon tooling, region Singapore if available, ONLY after asking the user for approval at that moment. Connection strings only in git-ignored `.env`/`.env.test`; never in chat or docs. | User, 2026-10-12 |
| U4 | Node and pnpm version pinning | Business | Node 24 (current LTS line, matches installed) via `.nvmrc` and `engines`; pnpm via `packageManager` field, current stable 10.x | Node 24 via `.nvmrc` + `engines`; pnpm 10.x via `packageManager`. | User, 2026-10-12 |
| U5 | Deployment/preview target for web and API | Business | Out of FEAT-000 scope: CI only, no deployment now; decide hosting with the open "Select hosting" item | Deployment is Vercel, but LATER, not in FEAT-000. FEAT-000 = CI only. | User, 2026-10-12 |
| U6 | Package scope/names and licence | Business | Private packages scoped `@ims/*` (`@ims/db`, `@ims/shared`; apps named `api`, `web`), `"private": true`, no licence file (proprietary) | Not asked. Default applied: private `@ims/*` (`@ims/db`, `@ims/shared`), apps `api` and `web`, `"private": true`, no licence file. User may change. | Minhaj default, user may change, 2026-10-12 |

**Requirements approved:** yes (2026-10-12)  <!-- Rabbi may start -->

## Assignment (Minhaj)

**User outcome:** A working, verifiable engineering foundation: a pnpm + Turborepo monorepo in git, with a NestJS API (health, validation, errors, logging), Prisma wired to Neon, Vitest, a Next.js + Tailwind web skeleton themed from `ui-tokens.md`, Playwright, and GitHub Actions CI. Every later feature can be built, tested and merged on top of it.

**Sub-features:** FEAT-000.1, FEAT-000.2, FEAT-000.3, FEAT-000.4, FEAT-000.5, FEAT-000.6, FEAT-000.7

**In scope:** FEAT-000.1 to FEAT-000.7 with decisions R1-R15 and U1-U6 above. Includes `git init` on `main`, `.gitignore`, `.nvmrc`, the Neon project and branches (with user approval at that moment), and the GitHub Actions workflow file.

**Out of scope:** any domain model or business logic; Better Auth (FEAT-002); deployment, Vercel setup and preview environments (later); pushing to a remote unless the user supplies the URL; dark mode; Bangla webfont; README; licence file.

**Sequencing:** Rabbi goes first and delivers FEAT-000.1 (scaffold) early. Rows 000.1-000.4 and 000.7 are `Backend` now. FEAT-000.5 and FEAT-000.6 stay `Todo` until Rabbi reports the 000.1 scaffold, then Shamim starts. Rabbi owns repo-level and CI workflow work; Shamim adds the web parts and the e2e CI job.

**Acceptance criteria:**
- AC-1: The folder is a git repository on branch `main` with a `.gitignore` that excludes `.env*` (except `.env.example`), `node_modules`, build output and Turborepo/Next caches; no secrets are committed (`git ls-files` shows no `.env` or `.env.test`).
- AC-2: `pnpm install --frozen-lockfile` succeeds on Node 24 with pnpm 10.x; `.nvmrc`, `engines` and `packageManager` are set; workspace packages are `api`, `web`, `@ims/db`, `@ims/shared`, all `"private": true`.
- AC-3: `pnpm turbo run lint typecheck build test` passes from the repo root; TypeScript is strict with `noUncheckedIndexedAccess`; `format:check` passes.
- AC-4: `GET /health` returns 200 with status and uptime only; `GET /health/ready` returns 200 when the DB is reachable and 503 when it is not, with the process staying up.
- AC-5: Every API response carries an `x-request-id` header (echoing a supplied one or a generated UUID); every log line and error body includes the same ID; authorization, cookie, password, token and connection-string values never appear in logs.
- AC-6: A request violating DTO validation returns 400 as `{statusCode, code, message, details, correlationId}` with field-level details and unknown properties rejected; an unhandled error returns 500 in the same shape with no stack trace.
- AC-7: The API fails to start with a clear message (no values printed) when a required env var is missing or invalid; `.env.example` lists every variable with placeholders only.
- AC-8: A Neon project exists with `main`, `dev` and `test` branches (Singapore if available), created only after explicit user approval; `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) are in git-ignored env files; `db:migrate:deploy` applies the empty baseline migration to `dev` and `test`; `db:status` reports no drift.
- AC-9: `db:seed` is idempotent (run twice, same result) and refuses to run when `NODE_ENV=production` or when pointed at the `main` branch.
- AC-10: `pnpm --filter api test` runs Vitest unit tests (Prisma mocked, no network) with a coverage report; the integration config aborts with a clear error unless the connection target is the `test` branch, and a connectivity integration test passes against it.
- AC-11: `pnpm --filter web build` and `lint` pass; the home page renders in the base layout (skip link, landmarks, visible focus) and shows API health fetched through the typed client using types from `@ims/shared`; with the API down it shows an explicit error state, not a blank page.
- AC-12: The Tailwind theme exposes the `ui-tokens.md` colours, spacing, radius, type scale and control sizes as semantic names; no raw hex values appear in components.
- AC-13: `pnpm --filter web test:e2e` runs the Playwright smoke spec (home loads, health shown) in Chromium locally and in CI; specs live in `apps/web/e2e/`, with `e2e/qa/` present for QA.
- AC-14: A GitHub Actions workflow runs on every push and pull request: frozen install, format check, lint, typecheck, build, unit tests with coverage, migration deploy plus drift check against a Neon test/child branch, and the e2e job. The same commands pass locally on a clean checkout (and in Actions once a remote exists); secrets come only from GitHub secrets and are not exposed to forked PRs.
- AC-15: `context/Library-docs.md` records exact pinned versions of Node, pnpm, NestJS, Prisma, Next.js, Tailwind, Vitest and Playwright with official doc URLs and access dates.

**Backend tasks (Rabbi):**
1. FEAT-000.1: `git init` on `main`, `.gitignore`, `.editorconfig`, `.nvmrc`, root `package.json` (`engines`, `packageManager`), `pnpm-workspace.yaml`, `turbo.json`, strict base tsconfig, ESLint flat config, Prettier; create `apps/api`, `packages/db`, `packages/shared` and a minimal `apps/web` package stub so workspaces resolve; package names per U6. Do this first and tell Minhaj when done so 000.5/000.6 can start.
2. FEAT-000.2: NestJS skeleton in `apps/api` per R3-R7 and R14: ConfigModule with validation, nestjs-pino, correlation-ID middleware, global ValidationPipe, global exception filter, health module, CORS. Error and health types in `@ims/shared`.
3. FEAT-000.3: `packages/db` Prisma per R8. Ask the user for approval at that moment, then create the Neon project and `main`/`dev`/`test` branches (Singapore if available) with the Neon tooling; write connection strings only into git-ignored `.env`/`.env.test`; never print them in chat or docs; guarded idempotent seed.
4. FEAT-000.4: Vitest per R9 (unit and integration configs, coverage, scripts, test-branch guard).
5. FEAT-000.7: `.github/workflows/ci.yml` per R12 including the migration drift check (the e2e job is completed with Shamim); document required GitHub secrets by name only. No remote push unless the user gives the URL.
6. Record pinned versions and doc URLs in `context/Library-docs.md`; fill the Backend handoff here.

**Frontend tasks (Shamim):** start after Rabbi reports the 000.1 scaffold.
1. FEAT-000.5: Next.js App Router + Tailwind in `apps/web` per R10; tokens from `ui-tokens.md` as semantic theme names; base layout with skip link, landmarks, focus style; home page showing API health via a typed client using `@ims/shared`; loading and error states; i18n-ready English strings. Register reusable primitives in `context/ui-registry.md`.
2. FEAT-000.6: Playwright per R11: config with `webServer`, `e2e/` and `e2e/qa/`, smoke spec, seeding hook in global setup, `test:e2e` script.
3. FEAT-000.7 (frontend part): add the e2e job to the CI workflow and confirm it passes; fill the Frontend handoff.

**QA focus (Tanvir):** Verify AC-1 to AC-15 from a clean clone (frozen install, `pnpm turbo run lint typecheck build test`, `test:e2e`); confirm no secrets or `.env` files are tracked (`git ls-files`, history grep); check correlation ID and redaction with a request carrying an Authorization header; stop the DB and confirm `/health/ready` returns 503 while `/health` stays 200; confirm the integration-test and seed guards refuse the wrong target; review the CI workflow for correctness and secret safety; confirm tokens match `ui-tokens.md`. Add `e2e/qa/` specs only where useful.

## Backend handoff (Rabbi)

### FEAT-000.1 Monorepo scaffold — done 2026-10-12

**Built:**
- Git: `git init -b main` (no remote, nothing committed yet: the Assignment does not ask for an initial commit). `.gitignore` excludes `node_modules`, `.env` / `.env.*` (keeps `.env.example`), `dist`/`build`/`out`/`.next`, `*.tsbuildinfo`, `.turbo`, `coverage`, `playwright-report`/`test-results`/`blob-report`, logs, editor/OS files, `.claude/settings.local.json`, `.vercel`. `.gitattributes` forces LF (Windows checkouts stay Prettier-clean).
- Root: `package.json` (private, `packageManager: pnpm@10.34.6`, `engines` node `>=24 <25`, pnpm `>=10 <11`; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `format:check`, `db:generate|migrate:dev|migrate:deploy|status|seed` via turbo, `queue`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `engineStrict`, tool-version `catalog:`), `turbo.json` (`build`, `lint`, `typecheck`, `test`, `test:e2e`, `dev`, `db:*`), `.nvmrc` (24), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, NodeNext), `eslint.config.mjs` (flat config, typescript-eslint `recommendedTypeChecked` with `projectService`, prettier-compatible), `.prettierrc.json` (single quotes, semicolons, 100 cols, LF), `.prettierignore`, `.editorconfig`, `.env.example` (R4 variables, placeholders only), `pnpm-lock.yaml`.
- Packages (all `"private": true`): `apps/api` (`api`, depends on `@ims/db` + `@ims/shared` via `workspace:*`, placeholder `src/main.ts`), `packages/db` (`@ims/db`), `packages/shared` (`@ims/shared`): each has `tsconfig.json` + `tsconfig.build.json` (excludes `*.spec.ts`/`*.test.ts`) and `build`/`typecheck`/`lint` scripts, emitting CommonJS + `.d.ts` to `dist/`. `apps/web` (`web`) is an empty placeholder `package.json`: Shamim scaffolds Next.js in 000.5 (replace the file; keep the name `web`).
- Versions recorded in `context/Library-docs.md` (Pinned versions table).

**API contract:** none in 000.1 (the health endpoints come in 000.2).

**Checks (2026-10-12, Node 24.19.0, pnpm 10.34.6):**
- `pnpm install --frozen-lockfile` (clean, after deleting all `node_modules`): pass
- `pnpm turbo run build lint typecheck --force`: 9/9 tasks pass (4 packages; `web` has no scripts yet)
- `pnpm format:check`: pass
- Probe (temporary file, deleted): `tsc` reports the `noUncheckedIndexedAccess` error; ESLint reports `no-floating-promises` and `require-await`. So strict mode and typed linting are both active.
- `git check-ignore`: `.env`, `.env.test`, `.env.local` ignored; `.env.example` tracked. `git add -A --dry-run` lists no `node_modules`, `dist`, `.turbo` or `.env` files.
- Unit tests: none yet (Vitest arrives in 000.4). `turbo run test` has no package tasks yet.

**Limitations / notes for later sub-features:**
- TypeScript is pinned to 6.0.3, not 7.0.2: typescript-eslint 8.71 supports `<6.1.0` only. TS 6 defaults `types` to `[]`, so the base sets `"types": ["node"]`. Web/DOM packages must override `lib`/`types`.
- `@typescript-eslint/consistent-type-imports` is deliberately off. Type-only imports break NestJS DI metadata (`emitDecoratorMetadata`).
- pnpm 10 blocks dependency build scripts. 000.2/000.3 must add `onlyBuiltDependencies` (e.g. `prisma`, `@prisma/client`, `@prisma/engines`) to `pnpm-workspace.yaml`.
- Turborepo strict env mode is on. 000.3/000.4 must declare `env`/`passThroughEnv` (e.g. `DATABASE_URL`, `DIRECT_URL`) for the `db:*`/`test` tasks.
- `scripts/feature-queue.mjs` is listed in `.prettierignore` so the team-owned script is not reformatted. All `*.md`, `context/`, `analysis/` and `.claude/` are excluded from Prettier too.
- A global npm-installed pnpm 9.15.4 remains under `%APPDATA%\npm`. Corepack's pnpm 10.34.6 in `C:\nvm4w\nodejs` resolves first in both Git Bash and PowerShell.

### FEAT-000.2 API skeleton, 000.3 Prisma + Neon, 000.4 Vitest, 000.7 CI: done 2026-10-12

**Built (000.2, `apps/api`):**
- NestJS 12 is ESM-only, so `api` is now `"type": "module"` (NodeNext, `.js` relative imports). Built with `tsc` (`emitDecoratorMetadata`), no Nest CLI. Scripts: `build`, `start` (`node --env-file-if-exists=../../.env dist/main.js`), `dev` (`scripts/dev.mjs`: `tsc --watch` + `node --watch`), `typecheck`, `lint`, `test`, `test:unit`, `test:watch`, `test:coverage`, `test:integration`.
- `src/main.ts` (TZ=UTC, pino logger, fail-fast exit 1), `src/app.module.ts`, `src/configure-app.ts` (shared by main and tests: correlation middleware, CORS for `WEB_ORIGIN` with credentials and exposed `x-request-id`, global ValidationPipe, global filter, shutdown hooks, `x-powered-by` off).
- Config: `src/config/env.validation.ts` (class-validator schema for `NODE_ENV`, `PORT`, `WEB_ORIGIN` (comma list), `LOG_LEVEL`, `DATABASE_URL`, optional `DIRECT_URL`; the error lists names and rules only, never values). `ConfigModule` uses `ignoreEnvFile` (env comes from the process).
- Correlation: `src/common/request-context/` (AsyncLocalStorage `RequestContext`, ready for tenant/user; the middleware accepts a safe inbound `x-request-id` (`[A-Za-z0-9._:-]{1,128}`), otherwise a UUID, and echoes it).
- Errors: `src/common/errors/` (`AppException` with code/details, `ErrorCode` list, `createValidationPipe` (whitelist, forbidNonWhitelisted, transform, nested field paths like `line.qty`), `AllExceptionsFilter` producing the R6 body; unexpected errors become 500 `INTERNAL_ERROR` "Internal server error").
- Logging: `src/common/logging/logger.options.ts` (nestjs-pino; `genReqId` = correlation ID, `correlationId` on every request log line; redacts authorization, cookie, x-api-key, set-cookie and password/token/secret/apiKey/connection-string keys up to 3 levels; the err serializer and a `logMethod` hook scrub `postgres://user:pass@` credentials; pretty output only in development).
- Database/health: `src/database/prisma.service.ts` (lazy Prisma client from `@ims/db`, pooled `DATABASE_URL`, `ping()` = `SELECT 1`), `src/health/health.controller.ts` (5 s readiness timeout).
- `@ims/shared` types reused unchanged (`ApiErrorBody`, `ApiErrorDetail`, `HealthResponse`, `ReadinessResponse`). No shape change, so `apps/web/src/lib/api/client.ts` needs nothing.

**Built (000.3, `packages/db` + Neon):**
- Neon project `inventory-management-system` (id `floral-rice-06629946`, aws-ap-southeast-1 Singapore, Postgres 18), created after the user's approval on 2026-10-12. Branches: `main` (default/production, `br-flat-rain-b3g6iuo6`), `dev` (`br-young-pine-b3cn7dbb`), `test` (`br-empty-silence-b3z01eks`). Database `ims`, role `ims_owner`.
- Env files at the repo root, both git-ignored: `.env` (dev branch) and `.env.test` (test branch), each with pooled `DATABASE_URL`, direct `DIRECT_URL`, `DB_TARGET`, `NEON_BRANCH_ID`, `NEON_MAIN_BRANCH_ID`. `.env.example` documents every variable and who reads it.
- Prisma 7.10.0: `prisma/schema.prisma` (`prisma-client` generator, CJS output to `src/generated/prisma`, git-ignored; datasource without URL), `prisma.config.ts` (loads the root `.env` or `IMS_ENV_FILE`, existing env wins; the CLI uses `DIRECT_URL`; seed = `node dist/seed.js`), `prisma/migrations/20261012000000_baseline` (empty: `SELECT 1`).
- `src/client.ts` `createPrismaClient()` (pg driver adapter, pooled URL), `src/target-guard.ts` (`assertTargetConfig`/`assertDbTarget`: refuse `NODE_ENV=production`, a wrong `DB_TARGET`, `NEON_BRANCH_ID` = main, and any database whose `current_setting('neon.branch_id')` is main or differs from `NEON_BRANCH_ID`), `src/seed.ts` (guarded, idempotent; no seed data yet).
- Scripts: `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:status`, `db:drift` (DB vs schema, `--exit-code`), `db:seed`, plus `db:migrate:deploy:test`, `db:status:test`, `db:seed:test` through `scripts/with-env.mjs .env.test` (cross-platform env loader). `postinstall: prisma generate`.
- Turbo: `build/lint/typecheck/test` depend on `db:generate` (one generate per run, no races); `db:*` and `test:integration` declare `DATABASE_URL`, `DIRECT_URL`, `IMS_ENV_FILE`, `DB_TARGET`, `NEON_BRANCH_ID`, `NEON_MAIN_BRANCH_ID`; `db:seed` depends on `build`; `globalPassThroughEnv`: `CI`, `TZ`, `PRISMA_HIDE_UPDATE_MESSAGE`. Root scripts added: `test:integration`, `db:drift`.
- pnpm build scripts: `allowBuilds` in `pnpm-workspace.yaml` (`prisma`, `@prisma/engines`, `@swc/core`: true; `unrs-resolver`: false). This is the current form in pnpm 10.34; pnpm maps it to `onlyBuiltDependencies`.

**Built (000.4, Vitest 5.0.3):**
- `apps/api/vitest.config.ts` (unit: `src/**/*.spec.ts`; setup `src/testing/unit-setup.ts` mocks `@ims/db` globally so no test can open a connection; placeholder env; V8 coverage text/html/lcov, no threshold), `vitest.integration.config.ts` (`src/**/*.int-spec.ts`, loads the root `.env.test`, serial; global setup `src/testing/integration-global-setup.ts` aborts unless `DB_TARGET=test` and the DB reports `NEON_BRANCH_ID`), `vitest.shared.ts` (unplugin-swc so decorator metadata works). `packages/db/vitest.config.mts` (guard tests).
- Tests: `config/env.validation.spec.ts`, `common/request-context/correlation-id.middleware.spec.ts`, `common/errors/all-exceptions.filter.spec.ts`, `common/logging/logger.options.spec.ts` (redaction), `health/health.controller.spec.ts`, `app.spec.ts` (full HTTP pipeline via supertest with Prisma mocked: CORS, x-request-id, 200/503 readiness, 400 validation with field details and an unknown property, 500 shape, 404), `packages/db/src/target-guard.spec.ts`; integration `health/health.int-spec.ts` (SELECT 1, `/health/ready` 200, baseline migration recorded).

**Built (000.7, `.github/workflows/ci.yml`):** runs on every push and pull request; `contents: read`; concurrency cancel. Jobs:
- `quality`: frozen install (pnpm store cached), Turborepo cache (`actions/cache` on `.turbo/cache`), `format:check`, `turbo run lint typecheck build test`, coverage artifact.
- `database` (skipped for fork PRs): creates a short-lived Neon branch `ci-<run_id>-<attempt>` from `test` (expires in 2 h, deleted in an `always()` step), masks the URLs, then runs `db:migrate:deploy`, `db:status`, `db:drift`, `db:seed` twice, `test:integration`.
- `e2e` (Shamim's 000.7 FE part, done by Rabbi from his notes): `playwright install --with-deps chromium`, builds web's workspace deps (`turbo run build --filter=web^...`), `pnpm --filter web test:e2e` (CI=true), uploads `apps/web/playwright-report` on failure.
- **GitHub secrets to add (names only):** `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_MAIN_BRANCH_ID`. No other secrets; the e2e job needs none.

**API contract:**

| Method | Path | Request | Response | Errors | Auth |
|---|---|---|---|---|---|
| GET | `/health` | none | 200 `HealthResponse` `{ status: 'ok', uptime: number }` (whole seconds). Never touches the DB. | none expected | Public |
| GET | `/health/ready` | none | 200 `ReadinessResponse` `{ status: 'ok', uptime: number }` after `SELECT 1` succeeds | 503 `{ statusCode: 503, code: 'NOT_READY', message: 'Service is not ready', correlationId }` when the DB is unreachable or slower than 5 s; the process stays up | Public |
| any | any | optional `x-request-id` header | Every response carries `x-request-id` (echoed if safe, otherwise a UUID). CORS `access-control-allow-origin` for `WEB_ORIGIN` only; `x-request-id` exposed. | All errors: `ApiErrorBody` `{ statusCode, code, message, details?: {field, message}[], correlationId }`. Codes: `VALIDATION_FAILED` (400, with details), `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `NOT_READY`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` (500, generic message) | n/a |

**Env vars (API / DB):** `NODE_ENV` (development/test/production, default development), `PORT` (default 3001), `WEB_ORIGIN` (required, comma list), `LOG_LEVEL` (default info), `DATABASE_URL` (required, pooled), `DIRECT_URL` (migrations), `DB_TARGET`, `NEON_BRANCH_ID`, `NEON_MAIN_BRANCH_ID` (seed/integration guards), `IMS_ENV_FILE` (internal, set by `with-env.mjs`). Web: `NEXT_PUBLIC_API_URL`.

**Commands and results (2026-10-12, Node 24.19.0, pnpm 10.34.6):**
- `pnpm install --frozen-lockfile`: pass
- `pnpm turbo run lint typecheck build test --force`: 15/15 tasks pass. Unit tests: api 41 passed (6 files; coverage statements 95.5%, branches 78.8%), @ims/db 9 passed (1 file)
- `pnpm format:check`: pass
- `pnpm --filter web test:e2e`: 4 passed (Chromium)
- `pnpm --filter api test:integration` (Neon test branch): 3 passed. Guard: with `NEON_BRANCH_ID` set to the dev id it aborts ("connected to branch ..., expected ..."); with `DB_TARGET=dev` it aborts
- `db:migrate:deploy` (dev) and `db:migrate:deploy:test`: baseline applied. `db:status` / `db:status:test`: "Database schema is up to date!". `db:drift`: "No difference detected."
- `db:seed` twice (dev) and `db:seed:test`: pass, same result. Refuses `NODE_ENV=production`, `NEON_BRANCH_ID` = main id, and a branch mismatch
- API `pnpm --filter api start`: `GET /health` 200 `{"status":"ok","uptime":8}` with `Access-Control-Allow-Origin: http://localhost:3000` and `x-request-id`; `GET /health/ready` 200 `{"status":"ok","uptime":9}` echoing `x-request-id: verify-ready-1`. With an unreachable `DATABASE_URL`: `/health/ready` 503 NOT_READY, `/health` still 200, password absent from logs. Missing/invalid env: exit 1 with names and rules only
- CI workflow: not run (no remote). The YAML parses (Prettier check); the same commands pass locally

**Limitations / notes:**
- `.github/workflows/ci.yml` is untested on GitHub until a remote exists and the 3 secrets are added. The Neon role/database names in the workflow are `ims_owner` / `ims`.
- The drift check compares the migrated database with `schema.prisma` (no shadow database needed). `prisma migrate dev` needs a shadow database; run it against the `dev` branch only.
- `db:seed` runs the compiled `dist/seed.js` (turbo `db:seed` builds first; with `pnpm --filter @ims/db db:seed`, run `build` first).
- `apps/web/e2e/global-setup.ts` seed hook is still a stub: the e2e smoke mocks the API. Wiring the real API + `db:seed:test` into Playwright is a later step (Shamim).
- The pg driver warns about `sslmode=require`; app URLs use `verify-full`. `DIRECT_URL` keeps `require` for the Prisma schema engine.
- The Prisma CLI shows an "update available 8.0.0-rc" banner; `PRISMA_HIDE_UPDATE_MESSAGE=1` hides it (CI sets it).
- FEAT-000.1 FE column in `feature-progress-list.md` is still `Todo` (Shamim/Minhaj to mark it N/A or Done), so the board is `Frontend - Shamim`, not `QA - Tanvir`.

## Frontend handoff (Shamim)

### FEAT-000.5 Next.js web skeleton and FEAT-000.6 Playwright setup: done 2026-10-12

**Built:**
- `apps/web` (package `web`, replaced the placeholder): Next.js 16.4.0 App Router, React 19.3.0, TypeScript strict (extends `tsconfig.base.json`, overrides `lib`/`module`/`moduleResolution`/`jsx`, keeps `types: ["node"]`), `src/` dir, Turbopack. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test:e2e`.
- Routes: `/` (home: title, intro, API health panel), `/_not-found` (Next default), `app/error.tsx` (global error boundary with retry and digest reference).
- Components: root layout (skip link, banner, `nav` "Primary", `main#main-content`, footer), `SkipLink`, `ApiHealthStatus` (client; loading, ok with uptime, network error, API error body with correlation ID, retry). Registered in `context/ui-registry.md`.
- Typed API client `src/lib/api/client.ts`: `apiFetch<T>`, `getHealth()`, `ApiError` (R6 body), `NetworkError`; base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`) in `src/lib/env.ts`. It does not send custom headers, so `GET /health` is a CORS simple request.
- Tailwind CSS 4.3.3 (CSS-first): `src/app/globals.css` `@theme` maps `ui-tokens.md` to semantic names: colours `canvas surface ink ink-muted line action action-hover on-action success warning danger info`; spacing `xs sm md lg xl 2xl 3xl` (4-48 px); controls `h-control` (40) and `touch` (48); radius `compact control panel`; type `text-label body-sm body heading-sm heading-md heading-lg`; system font stack (+ Noto Sans Bengali as fallback name). Default Tailwind palette removed so raw colours cannot be used; no hex outside the theme block. Light mode only. Caveat: spacing names `xl/2xl/3xl` shadow `max-w-xl` etc. (found when a panel collapsed to 24 px); use `max-w-prose`.
- i18n-ready: `src/i18n/messages.en.ts` (typed keys) and `t()` in `src/i18n/index.ts`; every visible string goes through it.
- ESLint: `apps/web/eslint.config.mjs` = root config + `eslint-config-next/core-web-vitals` (react, hooks, jsx-a11y, next rules).
- Added to `@ims/shared` (not backend logic, types only): `src/errors.ts` (`ApiErrorBody`, `ApiErrorDetail`) and `src/health.ts` (`HealthResponse`, `ReadinessResponse`), exported from `index.ts`. Needed so the client could be typed before 000.2 exists.
- Playwright 1.64.0 (Chromium only): `apps/web/playwright.config.ts` (testDir `e2e`, port 3100 via `E2E_PORT`, `webServer` = `pnpm run build && next start`, `reuseExistingServer` locally, trace on first retry, screenshot on failure, 2 retries and html report in CI), `e2e/global-setup.ts` (seed hook stub, throws if `E2E_SEED=1` until db:seed exists), `e2e/smoke.spec.ts`, `e2e/qa/` (`.gitkeep`, for Tanvir).
- Root files changed (only these): `pnpm-workspace.yaml` catalog gained `@playwright/test 1.64.0`, `@tailwindcss/postcss 4.3.3`, `@types/react 19.3.0`, `@types/react-dom 19.3.0`, `eslint-config-next 16.4.0`, `next 16.4.0`, `react 19.3.0`, `react-dom 19.3.0`, `tailwindcss 4.3.3`; `pnpm-lock.yaml` updated by install. `turbo.json` NOT changed (Turbo auto-includes `NEXT_PUBLIC_*` in the build hash; `test:e2e` ran fine under strict env mode). `context/Library-docs.md` got four version rows.

**Playwright:** spec `apps/web/e2e/smoke.spec.ts`; command `pnpm --filter web test:e2e` (also `pnpm test:e2e` through turbo); result 4 passed in Chromium (about 12 s, includes the production build). The spec mocks `GET {API}/health` with `page.route`, so it needs no API and no database. Tests: AC-13 home loads and shows health; AC-11 landmarks plus skip link by keyboard; AC-11 API down shows error state and recovers on Try again; AC-11 API error body shows correlation ID.

**Checks (2026-10-12, Node 24.19.0, pnpm 10.34.6):**
- `pnpm install --frozen-lockfile`: pass (unmet-peer warnings only: eslint-config-next plugins list ESLint up to 9; unrs-resolver build script ignored, harmless)
- `pnpm turbo run lint typecheck build`: 12/12 tasks pass
- `pnpm format:check`: pass
- `pnpm --filter web test:e2e`: 4 passed; `pnpm test:e2e` (turbo): pass

**Notes for QA:**
- Test data: none; the API is mocked in e2e. Roles: none (no auth until FEAT-002).
- To see the live path: run the API on :3001 (after 000.2) and `pnpm --filter web dev`; the panel should show "API is up". Stop the API and click Try again to see the error state. The API must allow CORS from `WEB_ORIGIN` (http://localhost:3000).
- Run on port 3100 so `next dev` on 3000 is unaffected. Set `E2E_PORT` to change it.
- First run on a machine needs `pnpm --filter web exec playwright install chromium`.
- Not covered yet (by design): dark mode, Bangla font, i18n second locale, real API integration test, axe accessibility scan.

**For Rabbi (000.2 / 000.7):**
- 000.2: `@ims/shared` already exports `ApiErrorBody` (R6: `statusCode, code, message, details?: {field, message}[], correlationId`) and `HealthResponse` (`{status: 'ok', uptime: number}` seconds). Reuse or extend them; if you change the shape, tell Shamim because `apps/web/src/lib/api/client.ts` relies on `statusCode` and `code` to recognise an error body. `GET /health` must send `access-control-allow-origin` for `WEB_ORIGIN`; the web fetch is a plain GET with `Accept` only (no preflight).
- 000.7 CI e2e job: after install run `pnpm --filter web exec playwright install --with-deps chromium`, then `pnpm --filter web test:e2e` (sets `CI=true` automatically on GitHub; uses 2 retries and `apps/web/playwright-report`, upload it as an artifact on failure). The e2e job needs no secrets, no API and no Neon branch today. Health-check integration (real API + test branch + seed via `E2E_SEED=1`) is a later step once 000.2/000.3 exist; wire `e2e/global-setup.ts` and a second `webServer` entry for the API then. I did not edit `.github/workflows` (Rabbi owns the file); the frontend part of 000.7 (e2e job) is still open.
- Do not add `NEXT_PUBLIC_*` secrets: they ship to the browser.

## QA report (Tanvir)

**Date / environment:** 2026-10-12, Windows 11, Node 24.19.0, pnpm 10.34.6, Chromium (Playwright 1.64.0). Clean run: all `node_modules`, `.turbo`, `dist`, `.next`, coverage and the generated Prisma client were deleted first (`.env` files untouched). Another process (not started by QA, a `pnpm dev`-style run) held ports 3000/3001 during QA, so live API checks used spare ports 3011-3013 and that process was never touched.

**Commands run / results:**

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (after clean) | pass (3m17s; `prisma generate` postinstall ran) |
| `pnpm turbo run lint typecheck build test --force` | 15/15 tasks pass. Unit: api 56 passed + 1 expected-fail (7 files), @ims/db 11 passed + 1 expected-fail; api coverage 95.5% statements / 78.8% branches |
| Same command with no DB env at all (`IMS_ENV_FILE` pointing at a missing file, `CI=true`; simulates the CI `quality` job) | 15/15 pass |
| `pnpm format:check` | pass |
| `pnpm --filter web test:e2e` (port 3001 busy) | 8 passed, 7 skipped (the new real-API QA file skips by design when its API port is taken) |
| `NEXT_PUBLIC_API_URL=http://localhost:3011 pnpm --filter web test:e2e` | 15 passed (4 dev smoke + 11 QA) |
| `pnpm --filter api test:integration` (Neon test branch) | 3 passed |
| `db:status` (dev) and `db:status:test` | "Database schema is up to date!" |
| `db:drift` (dev) and drift against test via `with-env.mjs .env.test` | "No difference detected." (there is no `db:drift:test` script) |
| `db:seed:test` twice, `turbo run db:seed` twice | pass, identical output (no seed data yet) |
| Local simulation of the CI `database` job (env vars exported, no env files): `db:migrate:deploy`, `db:status`, `db:drift`, `db:seed` x2, `test:integration` through `turbo --filter` | all pass |
| Neon MCP `list_branches` (read only) | project has `main` (default), `dev`, `test`; no leftover `ci-*` branches |

**Live integration (real API + real browser):** `/health` 200 `{status,uptime}`; `Access-Control-Allow-Origin` equals WEB_ORIGIN only (a foreign origin gets none); `x-request-id` generated or echoed (unsafe or over-long ids replaced by a UUID); preflight with `x-request-id` allowed and the header exposed. With an unreachable `DATABASE_URL` (env override, no `.env` edit): `/health/ready` returns 503 `{"statusCode":503,"code":"NOT_READY","message":"Service is not ready","correlationId":...}` in about 0.2 s, `/health` stays 200, process stays up, web panel still shows "API is up". Killing the API: web shows "Cannot reach the API"; restart plus Try again recovers. A request with `Authorization` and `Cookie` headers is logged as `[REDACTED]`, secret values absent, correlationId on every line. A wrong-password probe against the real Neon host: password, host and URL absent from logs (see observation 1).
Env validation: missing or invalid vars exit 1 with a list of names and rules; values (including secret-looking ones) are never printed.
Guards: seed refused for `NODE_ENV=production`, `NEON_BRANCH_ID` = main, `DB_TARGET=prod` and a branch mismatch; integration run aborted for `DB_TARGET=dev`, the dev branch id and `NODE_ENV=production` ("Integration tests aborted: Refusing to run ...").
Secrets: `git check-ignore` confirms `.env`, `.env.test`, `.env.local`, `.env.production` are ignored; `git ls-files` lists only `.env.example`; a scan of all 148 tracked files and the full git history for the real Neon host and password found 0 hits (test fixtures use fake credentials only); no env file was ever in history.
CI workflow (static review; `act` is NOT installed; GitHub Actions cannot be run and there is no remote): valid structure; triggers push (all branches) and pull_request; `permissions: contents: read`; concurrency cancel; jobs `quality`, `database`, `e2e`; `database` is skipped for fork PRs through `head.repo.full_name == github.repository`; secrets only `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_MAIN_BRANCH_ID`; DB URLs masked with `::add-mask::`; Neon branch deleted in an `always()` step and expires in 2 h; coverage artifact `always()`, Playwright report artifact on failure. All action tags exist (checked with the GitHub API) and the `db_url`, `db_url_pooled`, `branch_id` outputs and the `branch` input exist.

**New QA automation (kept in the suite):**
- `apps/web/e2e/qa/real-api.spec.ts` (7 tests): web against the real API, nothing mocked. It starts the API itself on the web build's API port, skips if the port is taken, builds `apps/api/dist` if missing. Broken-DB mode needs no secrets; the healthy-DB test uses the Neon test branch only and skips without `.env.test`.
- `apps/web/e2e/qa/tokens.spec.ts` (4 tests): AC-12 token values vs `context/ui-tokens.md`, no raw hex/rgb in components, rendered colours and focus ring.
- `apps/api/src/qa/http-edge-cases.spec.ts` (16 tests, 1 expected-fail for BUG 2): correlation id edge cases, R6 shape for 400/401/403/404/500, malformed JSON, secrets not leaking in 500, health minimality, CORS preflight.
- `packages/db/src/qa-target-guard.spec.ts` (3 tests, 1 expected-fail for BUG 1).

**AC results:**

| AC | Result | Notes |
|---|---|---|
| AC-1 | PASS | Repo on `main`; `.gitignore` covers `.env*` (except the example), node_modules, dist/.next/.turbo/coverage; no env file tracked; history scan clean. |
| AC-2 | PASS | Frozen install OK on Node 24.19 / pnpm 10.34.6; `.nvmrc`=24, `engines`, `packageManager` set; `api`, `web`, `@ims/db`, `@ims/shared` all private. |
| AC-3 | PASS | turbo lint/typecheck/build/test 15/15; `strict` and `noUncheckedIndexedAccess` in `tsconfig.base.json`; `format:check` passes. |
| AC-4 | PASS | Verified live (browser and curl), including 503 on an unreachable DB with the process staying up. |
| AC-5 | PASS | Header echo/generate, id in logs and error bodies, redaction verified live and in tests (observation 1). |
| AC-6 | PASS | 400 with field details and unknown property rejected, 500 generic with no stack (supertest; the live API has no DTO endpoint yet). Related defect: BUG 2 (413 becomes 500). |
| AC-7 | PASS | Fail-fast with names only; `.env.example` lists every variable with placeholders (observation 3). |
| AC-8 | PASS | Branches main/dev/test exist (Neon MCP); status and drift clean on dev and test. Region and the user-approval step rely on the handoff (aws-ap-southeast-1 recorded); approval cannot be re-verified. |
| AC-9 | FAIL (partial) | Idempotent; refuses production, wrong target and branch mismatch; but the "main branch" refusal depends on `NEON_MAIN_BRANCH_ID` being set: BUG 1. |
| AC-10 | PASS | Unit suite with Prisma mocked and coverage; integration guard aborts for non-test targets; connectivity test passes on the test branch. |
| AC-11 | PASS | Build/lint pass; landmarks, skip link, focus; health via the typed client against the real API; explicit error state on a real network failure. |
| AC-12 | PASS | Colours, spacing, radius, type scale and control sizes match `ui-tokens.md`; no raw hex outside the theme block. |
| AC-13 | PASS (gap) | Smoke spec and `e2e/qa/` run in Chromium. R11's "seeding hook in global setup calls the guarded seed" is still a stub that throws for `E2E_SEED=1`: BUG 3. |
| AC-14 | PASS locally / not verifiable on GitHub | The same commands pass locally on a clean install and the DB job was simulated with exported env; static review OK. No remote, so the workflow has never run. |
| AC-15 | PASS | `context/Library-docs.md` lists Node, pnpm, NestJS, Prisma, Next.js, Tailwind, Vitest, Playwright with versions, doc URLs and access dates. |

**Bugs found:**

- Title: DB target guard fails open when NEON_MAIN_BRANCH_ID is unset
  Severity: Medium
  Suspected layer: Backend (`packages/db/src/target-guard.ts`: the only "is this main" signal is the env var, and both the seed and the integration setup skip the main check when it is empty)
  Steps to reproduce: 1. Use an env where `DB_TARGET=dev`, `NEON_BRANCH_ID` and the URLs all point at the Neon main branch and `NEON_MAIN_BRANCH_ID` is missing or empty. 2. Run `pnpm --filter @ims/db db:seed`.
  Expected: guards refuse (fail closed) when the production branch id is not configured, so AC-9 holds regardless of env completeness.
  Actual: `assertTargetConfig` and `assertDbTarget` accept any branch id that matches `NEON_BRANCH_ID`, including main. (Not run against main; shown by unit test, and by running against the test branch with `NEON_MAIN_BRANCH_ID=` empty, where only the id mismatch stopped it.)
  Evidence: `packages/db/src/qa-target-guard.spec.ts` "refuses (fails closed) when NEON_MAIN_BRANCH_ID is not set" (marked `it.fails`; change to `it` when fixed).

- Title: Oversized request body returns 500 instead of 413
  Severity: Medium
  Suspected layer: Backend (`AllExceptionsFilter` only maps `HttpException`; body-parser's 413 error carries `status` but is not an HttpException, so it becomes INTERNAL_ERROR; `PAYLOAD_TOO_LARGE` exists in `ErrorCode` but is unreachable)
  Steps to reproduce: 1. POST a JSON body of about 2 MB to any route. 2. Observe status and body.
  Expected: 413 `{statusCode:413, code:'PAYLOAD_TOO_LARGE', message, correlationId}` and no server-error log.
  Actual: 500 `INTERNAL_ERROR` "Internal server error" plus an ERROR log line.
  Evidence: `apps/api/src/qa/http-edge-cases.spec.ts` "an oversized body returns 413 PAYLOAD_TOO_LARGE in the error shape" (`it.fails`; received 500).

- Title: Playwright global-setup seed hook not wired to db:seed
  Severity: Low
  Suspected layer: Frontend (`apps/web/e2e/global-setup.ts`; also partly a requirement-scope question: R11 asks for the hook but the smoke spec needs no data, so Minhaj may waive or defer it)
  Steps to reproduce: 1. `E2E_SEED=1 pnpm --filter web test:e2e`.
  Expected: global setup runs the guarded seed against the test branch (R11), now that `db:seed` exists.
  Actual: throws "seed hook is not wired yet (needs FEAT-000.3 db:seed)".
  Evidence: source of `apps/web/e2e/global-setup.ts`; the Frontend and Backend handoffs also list it as not done.

**Observations (not bugs, for Minhaj):**
1. When Postgres rejects a login, the Prisma message puts the DB role name (`ims_owner`) into the server log; password, host and URL are not logged. Arguably acceptable.
2. CI: the `e2e` job does not build `apps/api`, so the new real-API spec builds it on demand (about a minute); the no-secret tests run in CI, the Neon-test-branch test skips there. Dependabot PRs get no secrets, so the `database` job would fail for them. Actions are pinned by tag, not SHA. `push` plus `pull_request` on same-repo branches runs CI twice.
3. Env validation failure prints through Nest's ExceptionHandler with a stack trace around the clear message (main.ts's friendly catch is not reached because `ConfigModule.forRoot` throws at module load). Cosmetic.
4. `POST /health` answers 404, not 405 (`METHOD_NOT_ALLOWED` is never produced). Cosmetic.
5. `DB_TARGET` is only a label (test URLs with `DB_TARGET=dev` seed fine); safety rests on the branch id match.
6. Not verifiable locally: the GitHub Actions run itself, fork-PR secret behaviour, artifact upload, and the user-approval step for creating the Neon resources.

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
| BUG-001 | DB target guard fails open when NEON_MAIN_BRANCH_ID is unset | Backend | Rabbi | Fail closed: seed and integration guards must refuse when the production branch id is not configured (and reject a target equal to it). Flip the `it.fails` test in `packages/db/src/qa-target-guard.spec.ts` to a normal `it`. CI `database` job already sets the variable; keep it passing. Fixed 2026-10-12 (Rabbi). Root cause: `assertTargetConfig`/`assertDbTarget` in `packages/db/src/target-guard.ts` only compared against `NEON_MAIN_BRANCH_ID` when it was truthy, so a missing/empty value skipped every "is this main" check (fail open). Fix: both guards now require `NEON_MAIN_BRANCH_ID` and `NEON_BRANCH_ID` (trimmed, non-empty) and refuse before any DB query when either is missing; they refuse `NEON_BRANCH_ID` = main and a database reporting the main branch id; ids are compared trimmed. Seed and the integration global setup use these guards, so both fail closed. `.env`/`.env.test` already define the variable (checked by name, values not printed); the CI `database` job sets it from the `NEON_MAIN_BRANCH_ID` secret in every guarded step. Tests: `qa-target-guard.spec.ts` `it.fails` flipped to `it` (passes); its mismatch test now sets a main id so it still reaches the mismatch check; regression tests in `target-guard.spec.ts` (missing/empty/blank main id refused without querying; whitespace-padded ids). Live: `NEON_MAIN_BRANCH_ID= pnpm --filter @ims/db db:seed` refused ("NEON_MAIN_BRANCH_ID (the production branch id) is not set"); normal `db:seed` (dev) passes; `test:integration` 3 passed. | Verified |
| BUG-002 | Oversized request body returns 500 instead of 413 | Backend | Rabbi | Map body-parser errors (status/statusCode 413, type entity.too.large) in AllExceptionsFilter to 413 `PAYLOAD_TOO_LARGE` in the R6 shape, logged at warn, not error. Flip the `it.fails` test in `apps/api/src/qa/http-edge-cases.spec.ts`. Fixed 2026-10-12 (Rabbi). Root cause: `toErrorBody` in `apps/api/src/common/errors/all-exceptions.filter.ts` only recognised `HttpException`; body-parser throws http-errors objects (`status`/`statusCode` 413, `type: entity.too.large`, `expose: true`), so they fell through to 500 INTERNAL_ERROR and an ERROR log. Fix: non-HttpException errors with an integer 4xx `status`/`statusCode` keep that status and code (`codeForStatus`, so 413 becomes `PAYLOAD_TOO_LARGE`) in the R6 shape. The message is fixed per known body-parser `type` (413: "Request body is too large"), else the original only when `expose === true`, else "Request could not be processed". 5xx, non-integer or out-of-range statuses stay generic 500s. These middleware client errors are logged at warn by the filter (and the pino-http request line is warn); never error. Tests: `qa/http-edge-cases.spec.ts` `it.fails` flipped to `it` (passes, real 2 MB request through supertest); regression tests in `all-exceptions.filter.spec.ts` (413 mapping, statusCode-only 415, fixed vs exposed messages, 5xx/invalid statuses stay 500, warn-not-error logging). | Verified |
| BUG-003 | Playwright global-setup seed hook not wired to db:seed | Frontend | Shamim | Triage: honour R11 now that `db:seed` exists. When `E2E_SEED=1`, global setup runs the guarded `db:seed:test` (test branch only; no secrets-in-logs), no longer throws; without it nothing changes. Add a small test or documented check for the hook. Smoke spec needs no data, so keep it opt-in. Fixed 2026-10-12 (Shamim). Root cause: `e2e/global-setup.ts` was a stub that threw when `E2E_SEED=1` because `db:seed` did not exist in 000.5. Fix: new `apps/web/e2e/seed-hook.ts` (`seedIfRequested`) used by global setup. Flag unset: no-op, no DB needed. `E2E_SEED=1`: runs only `pnpm --filter @ims/db db:seed:test` (loads `.env.test` via `scripts/with-env.mjs`, carries the branch/production guards); when a local `.env.test` exists, inherited `DATABASE_URL`, `DIRECT_URL`, `NEON_BRANCH_ID`, `DB_TARGET`, `IMS_ENV_FILE` are dropped first so dev values cannot win (with-env never overrides set vars); in CI (no `.env.test`) the job-supplied test-branch vars are used. On failure it throws `E2E_SEED=1: ... db:seed:test failed (exit N)` plus the last 15 output lines with any `scheme://...` redacted; env values are never printed. Regression test: `apps/web/e2e/seed-hook.spec.ts` (3 tests: unset no-op, runs only db:seed:test, failure message clear and secret-free; runner injected, no DB). Checks: web lint, typecheck, format:check pass; `pnpm --filter web test:e2e` 11 passed / 7 skipped (QA real-API specs skip without their env), also 11 passed with `E2E_SEED=1` (real `db:seed:test` ran against the test branch, setup did not throw). | Verified |

**Observation decisions (Minhaj, 2026-10-12):**

| # | Observation | Decision | Reason / where recorded |
|---|---|---|---|
| 1 | DB role name appears in log on auth failure | Accept as-is | Role name is not a secret; password, host and URL are not logged. |
| 2a | CI e2e job does not build the API (real-API spec builds on demand, ~1 min) | Accept | Correct, only slower. Revisit if CI time hurts. |
| 2b | Dependabot PRs get no secrets, so the `database` job fails for them | Defer | Dependabot is not configured and there is no remote yet. Handle when a remote exists and Dependabot is enabled (CI hardening in FEAT-045 / first remote push). |
| 2c | Actions pinned by tag, not commit SHA | Defer | Pin to SHAs as part of CI hardening when the repo has a remote (FEAT-045). |
| 2d | push + pull_request run CI twice on same-repo branches | Accept | Harmless duplication; concurrency cancel already limits cost. |
| 3 | Env validation prints a Nest stack trace around the clear message | Accept | Cosmetic and boot-time only; message names the variables and never prints values. |
| 4 | `POST /health` returns 404, not 405 | Accept | Cosmetic; no consumer depends on it. |
| 5 | `DB_TARGET` is only a label | Accept | Safety rests on the branch-id match, which BUG-001 hardens. |
| 6 | GitHub Actions run, fork-PR secret behaviour and artifact upload not verifiable locally (no remote) | Defer to first push | AC-14 stays "passes locally"; the first push to the user's GitHub remote must be watched and any failure raised as a bug. Recorded here. |

## QA retest (Tanvir, 2026-10-12, main at 90be1aa)

**Verdicts:** BUG-001 Verified, BUG-002 Verified, BUG-003 Verified. No new bugs.

- BUG-001 (own repro, test branch only): `db:seed:test` with `NEON_MAIN_BRANCH_ID` empty, whitespace-only, or empty plus a different `NEON_BRANCH_ID` now exits 1 "Refusing to run: NEON_MAIN_BRANCH_ID (the production branch id) is not set."; `NEON_MAIN_BRANCH_ID` equal to `NEON_BRANCH_ID` refused; `NODE_ENV=production` refused; normal test and dev seeds pass. `test:integration` with the variable empty aborts with the same message; normal run 3 passed.
- BUG-002: live API, 2 MB JSON POST returns 413 `{"statusCode":413,"code":"PAYLOAD_TOO_LARGE","message":"Request body is too large","correlationId":"big-1"}`, logged once at warn (level 40), no error log; malformed JSON still 400; `/health` still 200.
- BUG-003: `E2E_SEED=1` runs the guarded `db:seed:test` on the test branch and the suite passes; with `E2E_SEED=1` plus `NODE_ENV=production` or an empty `NEON_MAIN_BRANCH_ID` global setup fails with a clear message and no connection string; without the flag nothing changes.

**Full suites from clean** (all node_modules/.turbo/dist/.next deleted): `pnpm install --frozen-lockfile` pass; `pnpm turbo run lint typecheck build test --force` 15/15 (api 64 passed, @ims/db 16 passed, no expected-fails left); `pnpm format:check` pass; `pnpm --filter web test:e2e` 18 passed with the API port free (real-API specs ran, not skipped), also 18 passed with `NEXT_PUBLIC_API_URL=http://localhost:3011` and with `E2E_SEED=1`; `pnpm --filter api test:integration` 3 passed.

**Typecheck vs build race (reported by Rabbi): NOT reproduced.** web `typecheck` (tsc, includes `.next/types`) has no turbo dependency on web `build`, so the race is possible in theory. Attempts: 4 runs of `turbo run typecheck build --force --filter=web` with `apps/web/.next` deleted each time; 6 full `turbo run lint typecheck build test --force` runs with `.next` present; 25 repeated `tsc` runs while `next build` ran; 3 rounds of `tsc` looped during a `next build` from an empty `.next` (12 overlapping runs). Zero failures. No bug filed. If it recurs in CI, add an ordering so web `typecheck` does not run while web `build` rewrites `.next/types` (turbo.json or the web `typecheck` script), suggested layer Frontend/tooling, severity Low.

**AC delta:** AC-6 PASS (413 now correct), AC-9 FAIL to PASS, AC-13 PASS (gap closed). All other ACs unchanged. All 15 ACs PASS; AC-14 remains "passes locally, GitHub run not verifiable" (deferred to the first push by Minhaj).

## Closure (Minhaj, 2026-10-12)

QA passed all 15 ACs (AC-14 verified locally only). BUG-001, BUG-002, BUG-003 fixed and verified by Tanvir. FEAT-000.1-000.7 are Done.

**Typecheck race decision:** `web#typecheck` failed once for Rabbi ("Cannot find module './routes.js'" in `.next/types`) during a full `--force` run; Tanvir could not reproduce it in about 45 attempts. Likely cause: `web#typecheck` has no turbo ordering against `web#build`, which regenerates `.next/types`. Decision: accept and watch, do not block closure. If it recurs once more, make a small tooling fix (run `next typegen` before `tsc` in the web `typecheck` script, or order typecheck after build in `turbo.json`). Tracked in `context/progress-tracker.md` under Follow-ups.

**Follow-ups waiting on the GitHub remote:** (1) the first push must have its CI run watched and any failure raised as a bug; (2) add the three GitHub secrets `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_MAIN_BRANCH_ID`; (3) CI hardening (SHA-pinned actions, Dependabot handling for the database job) deferred to FEAT-045. Tracked in `context/progress-tracker.md`.
