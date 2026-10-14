# Progress tracker

Last updated: 2026-10-13 (Asia/Dhaka).
Follow-up: 2026-10-13 — FEAT-046 automatic Codex observation verified (33 dashboard tests); FEAT-031.2 BUG-011 fixed, independently verified with 14 worker integration checks and closed during FEAT-002 development.
Workflow update: 2026-10-13 — adopted Fast / Standard / Deep execution lanes, affected-layer-only delegation, one final regression owner, targeted bug retests and automatic dashboard observation without model-generated heartbeats.

## Completed

- [x] FEAT-047 Application shell and auth UI closed 2026-10-14 (FE-only, Standard lane): auth layout, app shell, dashboard home, shared primitives, re-skinned pages. Independent QA: web lint/typecheck/build pass, Playwright 84 passed / 33 skipped (real-API specs), 33 new QA specs pass. BUG-015 (anonymous /businesses not redirected) fixed in 8a40fa9 and closed (retest 66 passed); open-redirect check on `next` safe for 11 hostile values.

- [x] FEAT-002 Authentication and user management closed 2026-10-13: invitation-only verified email/password, multi-business membership, mandatory owner/admin session MFA/recovery, tenant-local deactivation, own-session management and approved store-bound named register access with a fixed maximum 12-hour grant. BUG-012..014 fixed, independently verified and closed; 408 API unit, 16 DB unit, 188 guarded integration and all 86 browser scenarios verified (85 full-run passes plus one corrected-selector retest). Lint/types/build/format pass; owned test fixtures and servers cleaned up.

- [x] FEAT-046 Local agent dashboard closed 2026-10-12: `pnpm agents:dashboard`, four illustrated avatars, live SSE activity/session cards, shared worktree telemetry, Claude hooks and Codex reporting/heartbeat wrapper. Independent QA: 22 tests pass, including seven Chromium browser checks. Local developer tooling only; no database/customer-app change.

- [x] FEAT-031 Integration framework closed 2026-10-12 after resuming Claude's separate worktree: completed FI-1 retry timing and connection UI; BUG-008..010 fixed/verified; combined checks pass (383 API unit, 16 DB unit, 170 test-branch integration, 74 Playwright tests). Source consolidated into the primary workspace on a Codex branch.

- [x] FEAT-001 Tenancy and organization closed 2026-10-12 after Codex resumed Claude's QA handoff: BUG-004..007 fixed and independently verified; 322 API unit tests, 127 test-branch integration tests and 54 Playwright tests pass.

- [x] FEAT-000 Project setup closed 2026-10-12: monorepo, NestJS API skeleton, Prisma + Neon (main/dev/test), Vitest, Next.js + Tailwind skeleton, Playwright, GitHub Actions workflow (not yet run on GitHub).

- [x] Read the three supplied Markdown research documents.
- [x] OCR the 29-page image-only PDF and inspect a clipped table visually.
- [x] Identify the PDF as an apparent Compass export; flag duplicate evidence and clipped columns.
- [x] Record research agreement, scope conflicts and source limitations.
- [x] Confirm SaaS for multiple clothing brands.
- [x] Confirm store retail and automated online integrations in release one.
- [x] Create the requested context documentation set.

## In progress / next

- [ ] Confirm design partners, volumes and operating workflows.
- [ ] Select first ecommerce and courier providers.
- [ ] Decide offline stock policy and hardware support.
- [ ] Decide valuation, returns and inventory count rules.
- [ ] Verify applicable tax/export requirements.
- [x] Select stack and team (see Decisions).
- [ ] Hosting: Vercel chosen (deployment later, not in FEAT-000); delivery budget still open.
- [ ] Convert the proposed build plan into estimated milestones and reviewed acceptance criteria.

## Follow-ups (from FEAT-000)

- [ ] Run real-API Playwright specs once port 3001 is free (combined FEAT-003 + FEAT-047): the user's dev API holds port 3001 and no guarded test branch is configured, so ~33 real-API/real-DB specs have not run (FEAT-003 browser regression; FEAT-047 `authentication.spec.ts`, `organization-real-api.spec.ts`, `qa/real-api.spec.ts`, `qa/org-ui-qa.spec.ts`, `qa/integrations-real-api-qa.spec.ts`, including Shamim's sign-out edits in `authentication.spec.ts` and `helpers/auth-harness.ts`). Needs a free port 3001 and a guarded test branch.
- [ ] Owner question (FEAT-047, from Tanvir): auth pages use a deep-blue brand panel and are not fully white like the shell; confirm or request a fully light auth screen.
- [ ] FEAT-002 operational setup: roll out the reviewed authentication migration to the intended development/production branch before using normal sign-in there; configure SMTP sender and production auth secrets through host configuration. Only the guarded test branch was migrated during implementation. Future POS sales APIs must enforce the named register context; checkout/shifts remain FEAT-027.

- [ ] When the GitHub remote exists: push, watch the first CI run, raise any failure as a bug.
- [ ] Add GitHub secrets `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_MAIN_BRANCH_ID` (names only here; values never in repo).
- [ ] Before FEAT-031 runs outside dev/test: the user provisions `INTEGRATION_ENCRYPTION_KEY` (32 bytes, base64) and `INTERNAL_JOBS_SECRET` as host secrets (names only here, never in the repo). Losing the encryption key means every provider connection must be re-entered; rotation procedure is in FEAT-045.
- [ ] FEAT-031 follow-ups (Minhaj review 2026-10-12): (a) deployment work must add a GET alias or proxy for `POST /internal/jobs/run` because Vercel Cron sends GET with a bearer secret (assign in the FEAT-045 requirement review, build-plan stage 2 basic deployment); (b) FEAT-045 review adds purging of succeeded jobs/outbox rows (older than 30 days) to the retention job; (c) FEAT-032 review decides webhook-secret rotation per provider once D-02 is decided, master-key rotation stays in FEAT-045; (d) FEAT-038 review must show items blocked behind a dead item with the same ordering key.
- [ ] FEAT-045 open inputs from the user: verify the Neon plan allows 7 days PITR history; Sentry cost ceiling and account owner; primary and backup operator names. FEAT-042: name the client-side Bangla reviewer before pilot.
- [ ] CI hardening in FEAT-045: SHA-pinned actions, Dependabot handling for the `database` job.
- [ ] FEAT-031 operational verification: test live SIGTERM drain on Linux during CI/deployment; Windows unit drain checks pass.
- [ ] Watch: occasional `web#typecheck` failure ("Cannot find module ./routes.js" in `.next/types`); if it recurs, run `next typegen` before `tsc` or order typecheck after build.

## Not started

- [ ] Catalog, stock ledger and procurement.
- [ ] POS, offline synchronization and exchanges.
- [ ] Automated ecommerce/courier operations and COD reconciliation.
- [ ] Reporting, onboarding and operational recovery.
- [ ] Pilot testing and launch.

## Decisions

| Date | Decision | Source |
|---|---|---|
| 2026-10-12 | SaaS for multiple clothing brands | User confirmation |
| 2026-10-12 | First release prioritizes store retail and automated online integrations together | User confirmation |
| 2026-10-12 | Create project context files before implementation | User instruction |
| 2026-10-12 | Stack: pnpm + Turborepo monorepo; NestJS API; Next.js (App Router) + Tailwind web; PostgreSQL on Neon via Prisma; Vitest unit tests; Playwright E2E | User confirmation |
| 2026-10-12 | Delivery team agents: Minhaj (PM), Rabbi (backend), Shamim (frontend), Tanvir (QA); pipeline in `CLAUDE.md` | User instruction |
| 2026-10-12 | Authentication: Better Auth (D-01) | User confirmation |
| 2026-10-12 | FEAT-002 access: invitation-only verified email/password for existing tenants; owners/admins manage members; people may belong to multiple tenants; deactivation is tenant-local and the last active owner is protected. Public signup remains FEAT-043. | User confirmation (FEAT-002 Q1) |
| 2026-10-12 | FEAT-002 security: mandatory owner/admin TOTP MFA with recovery codes now; FEAT-002.4 promoted from optional P1 to required P0 delivery. Privileged access requires completed session second-factor verification. | User confirmation (FEAT-002 Q2) |
| 2026-10-12 | FEAT-002 POS access: named staff email/password on owner/admin-approved browser bound to an active store; maximum absolute 12-hour POS session and immediate device-revocation enforcement. No staff PIN/shared account/offline authentication now; cash shifts remain FEAT-027. | User confirmation (FEAT-002 Q3) |
| 2026-10-12 | Minhaj owns all requirement work: dependency-ranked queue (`feature-queue.md`) picks the next feature; requirement review and gap check precede every implementation | User instruction |
| 2026-10-12 | Git hosting: private GitHub repo; git initialised on `main` in FEAT-000 (no push until the user supplies the remote) | User confirmation |
| 2026-10-12 | CI: GitHub Actions | User confirmation |
| 2026-10-12 | Neon: Rabbi creates project and `main`/`dev`/`test` branches (Singapore if available) only after asking the user at that moment; connection strings only in git-ignored env files | User confirmation |
| 2026-10-12 | Runtime pinning: Node 24 via `.nvmrc` + `engines`; pnpm 10.x via `packageManager` | User confirmation |
| 2026-10-12 | Hosting: Vercel (later; FEAT-000 is CI only) | User confirmation |
| 2026-10-12 | Package scope: private `@ims/*` (`@ims/db`, `@ims/shared`), apps `api` and `web`, no licence file. User may change | Minhaj default |
| 2026-10-12 | Location model: tenant-wide locations not tied to a brand (brand lives on the style); exactly one type per location (store, warehouse, online_fulfilment) | User confirmation (FEAT-001) |
| 2026-10-12 | Document numbering: per-tenant sequence per document type, `PREFIX-YYYY-NNNNNN`, configurable prefix, calendar-year reset by business date (Asia/Dhaka); gap-free only where legally required (revisit with D-05) | User confirmation (FEAT-001) |
| 2026-10-12 | Rounding: 2 decimals, half-up (half away from zero), per line; tax rounding per FEAT-024; no cash rounding by default, per-tenant switch reserved | User confirmation (FEAT-001) |
| 2026-10-12 | Tenancy and auth: own `Tenant` table owns domain data; in FEAT-002 the Better Auth organization plugin maps 1:1 and carries only membership, invitations and roles | User confirmation (FEAT-001) |
| 2026-10-12 | Tenant isolation: application-level tenant scoping + composite tenant keys; no Postgres RLS for now (revisit in FEAT-045); currency BDT only and immutable | Minhaj (FEAT-001 review) |
| 2026-10-12 | Integration retry policy: 8 attempts, exponential backoff base 10 min, factor 2, cap 2 h, 0-20% jitter (total 6 h 48 min to 8 h 30 min, about 8 hours as the user asked), then dead-letter to a failure list with replay (FEAT-038); no email/push alerts in FEAT-031 | User confirmation (FEAT-031) |
| 2026-10-12 | Privacy: raw webhook payloads (customer personal data) kept in full 30 days, then blanked; metadata kept 12 months, then deleted | User confirmation (FEAT-031) |
| 2026-10-12 | Integrations: several connections per provider per tenant, each labelled and optionally linked to a brand; mapping is per connection | User confirmation (FEAT-031) |
| 2026-10-12 | Queue/worker: Postgres-backed (no Redis), hosting-agnostic worker (long-running process or secret-protected HTTP trigger); production host chosen with the deployment feature | Minhaj (FEAT-031 review) |
| 2026-10-14 | Cash shifts (FEAT-027): one open shift per register owned by the opening user; cashier counts blind; variance needs a note, above tenant threshold (default 0) needs manager override and the shift still closes; fixed cash in/out reason codes; cash counted only (card/wallet expected totals); shifts survive POS session expiry, flagged after 16 h, manager force-close, no auto-close; opening float free entry; Z immutable; a POS sale requires an open shift (enforced in FEAT-025) | User confirmation (FEAT-027 B1-B9, accept all proposed) |
| 2026-10-14 | Integration ops (FEAT-038): owner/admin view/replay, discard owner/admin only with mandatory reason and record kept; health Healthy/Warning (lag 15-60 min)/Critical (dead item or lag over 60 min); bulk replay capped at 100 per click; stock drift reconciliation (038.3) deferred until FEAT-032 ships | User confirmation (FEAT-038 Q1-Q5) |
| 2026-10-14 | Localization (FEAT-042): tenant default language plus per-user cookie override; "৳ 1,250.00", digits follow language except barcodes/SKUs/document and phone numbers/exports (Latin); lakh/crore grouping in both languages; dates dd/mm/yyyy with 12-hour am/pm; business timezone changeable by owner/admin with warning, posted documents keep their business date; agent drafts Bangla, client-side Bangla-fluent reviewer before pilot plus glossary | User confirmation (FEAT-042 Q1-Q6) |
| 2026-10-14 | Recovery (FEAT-045): RPO 15 min, RTO 4 h; weekly logical dump kept 30 days off-platform; 7-day Neon PITR history accepted only if the Neon plan allows (NOT yet verified); whole-database restore only (tenant data recovered manually); Sentry chosen for error tracking with operator email (+ optional chat) alerts; primary and backup operator, business hours, 1 h critical response; keep application-level isolation for the pilot and revisit RLS after the pilot | User confirmation (FEAT-045 Q1-Q6; open: Neon plan check, Sentry cost ceiling and owner, operator names) |
| 2026-10-14 | Delivery mode fully-agentic: agents build and verify, no human review gate, `Review` status invalid, agent estimate columns only | User decision |
| 2026-10-14 | FEAT-047 Application shell and auth UI added by the project owner (FE-only, Standard): light theme with the agent dashboard layout, auth card layout, permission-gated sidebar shell, dashboard home, shared page primitives, re-skin of existing pages; client-side unauthenticated redirect only (API remains enforcement); Bangla text via t(), catalog and switcher stay in FEAT-042.1 | User directive |

Proposals such as modular monolith, initial provider count and UI tokens remain unapproved implementation choices.
