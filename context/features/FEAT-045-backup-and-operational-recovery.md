# FEAT-045: Backup and operational recovery

Status: Requirements - Minhaj (answers accepted 2026-10-14; pending human approval of review and estimates)

## Requirement review (Minhaj)

**Sub-features:** FEAT-045.1 Backup / restore procedure, FEAT-045.2 Monitoring and alerting, FEAT-045.3 Runbooks

**Dependencies done:** FEAT-000.3 Prisma + Neon (Done): `main`/`dev`/`test` branches, `packages/db/src/target-guard.ts` (refuses the `main` branch), guarded `scripts/deploy-test-migrations.mjs`, `db:drift`/`db:status` scripts. FEAT-031 (Done) supplies the worker, retention and `POST /internal/jobs/run`.

**Existing implementation (evidence):** `GET /health` and `/health/ready` (DB ping, 5 s timeout); structured logging with correlation IDs; CI workflow; migrations carry reversal SQL in headers; `INTEGRATION_ENCRYPTION_KEY` with key id. Missing: backup/restore procedure, restore drill, error tracking, job-failure or sync-lag alerting, runbooks, and any production deployment (Vercel chosen, nothing deployed).

**Carried-in follow-ups (progress-tracker, FEAT-031):** (a) GET alias for `/internal/jobs/run` because Vercel Cron sends GET with a bearer secret; (b) purge succeeded jobs/outbox rows older than 30 days in the retention job; (c) master-key rotation for `INTEGRATION_ENCRYPTION_KEY`; plus FEAT-001's "no Postgres RLS for now (revisit in FEAT-045)".

**Sources checked:** `feature-list.md`, `architecture.md` ("automated backups and tested restoration; set RPO/RTO during discovery"), `build-plan.md` stage 5 (verify backup restoration), `roadmap.md`, `progress-tracker.md` (follow-ups, RLS decision, Neon branches, Vercel), FEAT-031 handoff (retention, worker, internal jobs), `project-rules.md`, repository files above.

**Gap checklist:**
- [x] User roles and permissions: operational access (Neon, Vercel, alert channel) is platform operator only; no tenant-facing UI. Q5 on-call.
- [x] Business rules and policies: RPO/RTO (Q1), retention (Q2), restore scope (Q3), alert channel (Q4), responder (Q5), RLS (Q6).
- [x] Data fields, validation, uniqueness: no tenant schema change; metrics derive from `jobs`/`outbox_events`.
- [x] States and transitions: restore always into a NEW Neon branch, verified, then connection cut over; never in place over `main`.
- [x] Failure, edge and concurrency cases: restore while workers run (stop worker or cut over first); post-restore reconciliation (outbox re-delivered at-least-once, handlers idempotent; webhook events after the restore point re-fetched per provider); key loss; bad-migration rollback via header reversal SQL; failed production migration.
- [x] Tenant and location scope: whole-database backups; no per-tenant restore initially (Q3). Isolation unchanged.
- [x] Money / tax / timezone: none; alert timestamps UTC.
- [x] Audit needs: restore drills and operator interventions recorded in the runbook log; audit table later via FEAT-004.
- [x] UI screens and flows: none (backend and docs only).
- [x] Integrations: Neon (PITR/branching, history window depends on the plan), Vercel Cron, an error-tracking service, an alert channel. New third-party services need a decision (Q4, project rule 10).
- [x] Open decisions: delivery budget and hosting plan (progress-tracker, open) affect the Neon history window and tool choice.

**Gaps found:**

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | Restore method | Routine | Neon point-in-time restore into a new branch (not in place); documented checklist plus a guarded helper that refuses `main` as a target and verifies migration status and row counts after restore | as proposed | Minhaj |
| R2 | Restore drill | Routine | Restore a past timestamp into a throwaway branch, run `db:status`, readiness, an isolation and counts smoke query, record elapsed time, delete the branch. Run on `dev` with user-approved Neon access | as proposed | Minhaj |
| R3 | Monitoring signals | Routine | 5xx rate and exceptions, readiness failures, worker last-run age, dead job count, oldest pending job age (sync lag), DB connection failures; thresholds reuse FEAT-038 values | as proposed | Minhaj |
| R4 | Cron alias and purge | Routine | Add `GET /internal/jobs/run` (same bearer guard); retention job also purges succeeded jobs/outbox older than 30 days; tests for both | as proposed | Minhaj |
| R5 | Master key rotation | Routine | Documented procedure using the key id (re-encrypt script, old key kept until all rows migrated), run by the operator | as proposed | Minhaj |
| R6 | Runbooks | Routine | Markdown under `docs/runbooks/`: restore, migration rollback, stuck worker, dead-letter flood, key loss, provider outage, emergency tenant suspension; each with trigger, steps, verification, owner | as proposed | Minhaj |
| Q1 | RPO and RTO targets | Business | RPO 15 minutes (PITR), RTO 4 hours for a full restore, validated by the drill | as proposed (accepted) | user, 2026-10-14 |
| Q2 | Backup retention | Business | 7 days point-in-time history on Neon (confirm plan allows) plus a weekly logical dump kept 30 days off-platform | accepted conditionally: 7 days Neon history ONLY if the Neon plan allows it (plan NOT yet confirmed; open verification V1); weekly logical dump kept 30 days off-platform accepted | user, 2026-10-14 (conditional) |
| Q3 | Restore scope | Business | Whole database only for the pilot; one tenant's data is recovered manually by the operator (branch restore plus targeted export); no self-service tenant restore | as proposed (accepted) | user, 2026-10-14 |
| Q4 | Alert tool and channel | Business | Sentry free tier for errors (new third-party holding redacted error data) and alerts to one operator email plus an optional chat channel; no customer alerts. Confirm tool, cost ceiling and account owner | Sentry tool choice and email (+ optional chat) alerts accepted; cost ceiling and account owner NOT given (open O1) | user, 2026-10-14 (partial) |
| Q5 | Who responds | Business | Named primary and backup operator, business hours only for the pilot, 1 hour response target for critical alerts; user names them | model accepted (primary + backup, business hours, 1 h critical response); operator names NOT given (open O2) | user, 2026-10-14 (partial) |
| Q6 | Postgres row-level security | Business | Keep application-level isolation for the pilot and record a decision to revisit RLS after the pilot; no work in this feature | as proposed (accepted) | user, 2026-10-14 |

**Estimates:** 045.1 6 agent h, 045.2 6.5, 045.3 3.25 = 15.75 agent h; human verify 5.25 h.

**Open items (need user input; not decided):**
- V1 (Q2): verify the Neon plan allows 7 days point-in-time history. The user accepted 7 days conditionally and has not confirmed the plan. If the plan allows less, RPO/retention must be re-agreed.
- O1 (Q4): Sentry cost ceiling and account owner not given by the user.
- O2 (Q5): primary and backup operator names not given by the user.

**Requirements approved:** pending human approval of review and estimates (Q1, Q3, Q6 and the tool/model parts of Q2, Q4, Q5 accepted by user 2026-10-14; open items V1, O1, O2 remain - NOT ready for human approval)

## Assignment (Minhaj)

**Execution lane:** Deep

**Why this lane / final verifier:** Restore, migration rollback and key rotation are destructive-data and migration-class operations; the retention purge deletes rows; monitoring touches workers. Backend (Rabbi) plus independent QA (Tanvir); no frontend layer. The restore drill output is the main acceptance evidence and needs human sign-off.

**DRAFT - not final until requirements are approved and V1, O1, O2 are closed.**

**User outcome:** The platform operator can restore the database to a point within 15 minutes of an incident in under 4 hours, is alerted to errors and job failures, and has written runbooks for incidents.

**In scope:** 045.1 PITR restore into a new branch with guarded helper and drill; 045.2 Sentry error tracking, worker/job/readiness signals and alerts to one operator email (optional chat), `GET /internal/jobs/run` alias, 30-day purge of succeeded jobs/outbox; 045.3 runbooks under `docs/runbooks/`, master-key rotation procedure, weekly logical dump procedure (30 days off-platform).
**Out of scope:** per-tenant self-service restore, customer-facing alerts, Postgres RLS (revisit after pilot), any UI.
**Sub-features:** FEAT-045.1, 045.2, 045.3. **Layers:** Rabbi (BE) then Tanvir (QA); FE N/A.
**Acceptance criteria (draft):** restore drill on `dev` into a throwaway branch passes `db:status`, readiness and count/isolation smoke checks with elapsed time recorded against RTO 4 h; helper refuses `main` as target; alert fires on a forced error and on a dead job; GET cron alias requires the bearer secret; purge removes only succeeded rows older than 30 days (tested); each runbook has trigger, steps, verification, owner.
**QA focus:** purge boundary and no deletion of pending/dead rows; guard refusal of `main`; alert thresholds; drill evidence. Human signs off the drill output.
**Lane:** Deep (see above). Sentry setup and the live drill need user-approved Neon/Sentry access at that time.
