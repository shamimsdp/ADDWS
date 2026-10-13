# FEAT-031: Integration framework

Status: Done (2026-10-13, BUG-011 independently verified and closed)

## Requirement review (Minhaj)

**Sub-features:** FEAT-031.1 Transactional outbox, FEAT-031.2 Background worker and job queue, FEAT-031.3 Connector abstraction, FEAT-031.4 Inbound webhooks, FEAT-031.5 Retry with backoff and dead-letter, FEAT-031.6 Connection settings UI

**Dependencies done:** `feature-list.md` previously said `Depends on: FEAT-000`. Review finding: every outbox event, job, inbound webhook event and connection is tenant-owned, and worker handlers must run with a restored tenant context. That needs the FEAT-001 tenant model, tenant-scoped data access and `TenantContext` (FEAT-001 R1, R3). Dependency corrected in `feature-list.md` to `Depends on: FEAT-000, FEAT-001`. FEAT-000 is Done. FEAT-001 is in progress (Backend, Rabbi), so FEAT-031 cannot start implementation until FEAT-001's backend handoff exists.
- Can proceed independently of FEAT-001: this requirement review, the design of the job/outbox/retry engine, and the tenant-agnostic parts (backoff calculator, error classification, signature verification utilities, credential encryption utility, connector interface and registry), which need no tenant tables.
- Needs FEAT-001: the tables (outbox, job, inbound event, connection), the worker's tenant-context restoration and the connection settings API/UI.
- Does not need FEAT-002/003: connection management uses the interim owner/admin capability from FEAT-001 R3 until FEAT-003 replaces it. Audit table (FEAT-004) is not needed; mutations are logged.

**Sources checked:**
- `context/feature-list.md` (FEAT-031 notes; consumers FEAT-032 catalog mapping, FEAT-033 order intake, FEAT-034-037 courier/COD, FEAT-038 integration health), `feature-progress-list.md`, `feature-queue.md`
- `context/architecture.md` (Integrations; Transaction boundaries: outbox events commit atomically with posting, provider calls outside DB transactions with explicit pending/success/failure reconciliation, unique tenant-scoped idempotency keys and external event identities; background workers for imports/integrations/notifications)
- `context/code-standards.md` (idempotent posting, versioned provider payloads and mapping records, structured errors, correlation IDs, redacted logs, no credentials or customer data in logs; test webhook replay and duplicate sync)
- `context/project-rules.md` (rule 5 no payment success inferred; rule 6 limited initial integrations; rule 10 no microservices; rule 13 secrets and customer records out of source/fixtures/docs; rule 14 test integration retries)
- `context/workflow.md` (Integration failure workflow: record event, retry safely, expose unresolved exception, replay/reconcile, verify consistency; state rules)
- `context/build-plan.md` stage 5 (replay/reconciliation tools, failed calls recover, duplicated/out-of-order events do not duplicate stock), `context/Library-docs.md` (provider docs needed: webhooks, scopes, rate limits; ecommerce/courier/payment selection open), `context/progress-tracker.md` (D-02, D-02b, D-08 open; Vercel chosen for later deployment)
- `context/ui-rules.md` (integration technical detail belongs in admin diagnostics; never imply an unconfirmed provider payment is settled; explicit states), `context/ui-registry.md`
- FEAT-001 review (`context/features/FEAT-001-tenancy-and-organization.md`): tenant context, scoped data access, interim admin, dev header, `x-request-id` correlation
- Repo state: `apps/api` has config, database (Prisma), health, common (errors, logging, request-context); no queue, no crypto utilities, no raw-body handling for webhooks yet; `apps/web` base layout and typed client.
- Research at repo root: `deep-research-report.md` and `compass_artifact_*.md` (integration needs: ecommerce and courier connectors, COD reconciliation, webhooks; offline queue is a separate concern), `clothing_inventory_management_software_product_spec.md` (sync queue, integration concepts). Discovery material, not approved decisions.

**Gap checklist:**
- [x] User roles and permissions: Only owner/admin manage connections (interim capability from FEAT-001 R3; FEAT-003 later). The webhook endpoint is public by design and authenticated by signature, not by user. Credentials are never returned to any role.
- [x] Business rules and policies: Questions Q1 (retry window and dead-letter handling), Q2 (raw payload retention), Q3 (several connections per provider). Framework rules decided in R1-R14. Core never imports a provider; no real provider exists until D-02/D-02b are decided.
- [x] Data fields, validation, uniqueness: R4-R8. Uniqueness: outbox dedupe key unique per tenant; inbound event unique (connection, external event id); inbox dedupe unique (tenant, consumer, message id); connection label unique per tenant and provider.
- [x] States and transitions: R3 (outbox/job states), R6 (inbound event states), R8 (connection states). Each transition is explicit and tested.
- [x] Failure, edge and concurrency cases: R2 (atomic claim, lease expiry, graceful shutdown), R3 (at-least-once, duplicate delivery tolerated by inbox dedupe), R5 (retry classes, Retry-After, jitter), R6 (bad signature, replay, duplicate, stale, oversized body, disabled connection), R9 (per-tenant fairness), R10 (secrets, key loss).
- [x] Tenant and location scope: Every table carries `tenantId` (FEAT-001 composite-key conventions); workers restore the tenant context from the row before running a handler; webhook intake resolves the tenant from the connection, never from the payload. Location scope: not applicable at framework level (connectors map locations in FEAT-032/034).
- [x] Money / tax / timezone rules: No money handling in the framework. All timestamps UTC timestamptz; `runAt`, lease and backoff in UTC; provider event times are stored as received plus parsed UTC.
- [x] Audit needs: FEAT-004 does not exist yet. Connection create/update/enable/disable/credential rotation and manual replay/discard of dead jobs are logged with actor, tenantId, entity, action and correlationId (never credential values). Replay and discard are explicit actions to be audited later.
- [x] UI screens and flows: FEAT-031.6 only: "Integrations" settings page (R11). Dashboard and failed-event list are FEAT-038. No operational screens here (ui-rules: technical detail stays in admin diagnostics).
- [x] Integrations: Framework only. Real ecommerce provider (D-02) and courier (D-02b) are open; a test-only loopback connector proves the framework end to end. Vercel hosting (later) shapes how the worker is triggered (R2).
- [x] Open decisions (D-xx): none block FEAT-031 itself. D-02, D-02b and D-08 block the providers that will use it (FEAT-032, 033, 035-037, 026.4). Hosting for the API and worker is not decided; the design stays hosting-agnostic (R2).

**Gaps found:**

Routine, reversible, implementation-level (decided by Minhaj):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | Queue technology | Routine | Postgres-backed only (outbox and job tables in the existing Neon database); no Redis or new infrastructure (project rule 10). Rabbi may use a maintained library (for example pg-boss) or a small own implementation on Prisma, after verifying current docs and Neon pooled/direct connection behaviour; constraints: atomic claim (`FOR UPDATE SKIP LOCKED` or equivalent), tenant column and tenant-context restoration, UTC timestamps, no extra service to host. Decision and pinned version recorded in `Library-docs.md`. | As proposed. Reason: one database, transactional enqueue with domain changes, nothing new to run or pay for; reversible behind a thin interface. | Minhaj |
| R2 | Where the worker runs (hosting-agnostic) | Routine | Core logic is `runDueWork({ maxJobs, timeBudgetMs })`. Two entry points share it: (a) a long-running worker process (`apps/api` worker mode, graceful SIGTERM drain) for always-on hosts; (b) a secret-protected HTTP trigger (`POST /internal/jobs/run`, constant-time secret check, no tenant context, disabled when the secret is unset) so a scheduler such as Vercel Cron can drive it. Which is used in production is decided with the deployment feature, since Vercel (chosen for later) is serverless and cron granularity limits latency. Local dev and tests use (a) or call the function directly. | As proposed. Reason: avoids committing to a host the user has not chosen; both paths covered by tests. | Minhaj |
| R3 | Outbox and job semantics | Routine | Outbox: `enqueue(tx, event)` writes in the caller's transaction (event type, aggregate type/id, versioned JSON payload, optional dedupe key unique per tenant, optional ordering key). Relay claims pending rows and dispatches to handlers registered by event type; delivery is at-least-once, handlers must be idempotent; events with the same ordering key run one at a time in sequence order; no global ordering. Jobs: type, payload, tenant (nullable for platform jobs), `runAt`, attempts, max attempts, lease (`lockedBy`, `lockedUntil`, default lease 5 min, heartbeat for long jobs), states `pending` -> `running` -> `succeeded` | back to `pending` (retry) | `dead`; `cancelled` for manual discard. Recurring work (for example polling fallback in FEAT-033.1) via an idempotent `schedule(type, key, everyMs)` that re-enqueues itself. A consumer inbox table (tenant, consumer, message id unique) lets handlers skip duplicates. | As proposed. Reason: matches architecture.md (atomic outbox, idempotent consumers) without global ordering costs. | Minhaj |
| R4 | Outbox/job/inbox schema conventions | Routine | All three tables follow FEAT-001 conventions (tenantId NOT NULL, composite keys, UTC timestamptz, opaque ids). Payloads are JSONB with an explicit `schemaVersion`. Indexes on (status, runAt) and (tenantId, status). Last error stored redacted and truncated (500 chars). | As proposed. Reason: consistency and queryability for FEAT-038. | Minhaj |
| R5 | Retry, backoff, dead-letter mechanics | Routine | Exponential backoff to match the user's Q1 answer of about 8 hours: base 10 min, factor 2, cap 2 h, default max 8 attempts (7 waits: 10, 20, 40, 80, 120, 120, 120 min = 8 h 30 min nominal), with 0-20% jitter subtracted (`JOB_BACKOFF_JITTER` = 0.2, so each wait is 80-100% of nominal; total 6 h 48 min to 8 h 30 min, about 7 h 40 min on average). Revised 2026-10-12 after the backend handoff showed the original 30 s / 1 h cap / full jitter values gave only about 64 minutes worst case; handlers throw typed errors: `RetryableError` (default for network/5xx/timeouts; honours provider `Retry-After`), `NonRetryableError` (4xx validation/auth/mapping problems go straight to `dead`), `RateLimitedError`. Dead jobs keep payload, attempts and redacted error history, stay queryable, and can be replayed (`replay(jobId)` resets attempts, new run) or discarded by service methods; API and UI for these are FEAT-038.2. Outbound provider calls: timeout 10 s, never inside a DB transaction (architecture rule), idempotency key supplied to providers that support one. | As proposed. Reason: standard, testable, matches workflow.md failure sequence. | Minhaj |
| R6 | Inbound webhook intake | Routine | Public `POST /webhooks/:provider/:connectionId` (opaque connection id). Raw body preserved for signature checking; body limit 1 MB (413 mapped per FEAT-000 BUG-002); the connector verifies the signature (HMAC-SHA256 style, constant-time compare, timestamp tolerance 5 min when the provider supplies one for replay protection); unknown connection 404; bad or missing signature 401 with no detail; valid event persisted durably first (`inbound_event`: connection, external event id, provider event type, payload, received at, provider timestamp/sequence, status) and acknowledged 2xx before processing; processing happens through a job. Duplicate (same connection and external event id) returns 2xx and is not reprocessed. Out-of-order: connector declares an ordering strategy (provider timestamp, version/sequence, or none); an event older than the last applied for the same resource is marked `ignored_stale`, not applied, and kept for inspection. Disabled connection: event is stored as `held` (2xx) and processed when re-enabled (held events older than 7 days move to status `discarded`). Unknown or unsupported event types are stored as `ignored_unsupported`. States: `received` -> `queued` -> `processed` | `failed` (goes to retry/dead via its job) | `ignored_stale` | `ignored_unsupported` | `held` | `discarded`. | As proposed. Reason: durable-first acknowledgment prevents lost events; stale/duplicate handling is required by build-plan stage 5. | Minhaj |
| R7 | Connector abstraction | Routine | A `Connector` interface per provider and version: static metadata (provider key, display name, connector version, credential field schema, supported event types, ordering strategy, rate limit), `verifyWebhook`, `parseEvent` (provider payload to a versioned internal event, with payload schema version kept), `testConnection`, and provider-call helpers built on a shared `ConnectorHttpClient` (timeout, retry classification, Retry-After, token-bucket rate limiting per connection, redacted logging). A registry resolves connectors; core framework code never imports provider code. Provider payload contracts are versioned; a connection records the connector version it was set up with. A test-only `loopback` connector (registered only in `development`/`test`) exercises everything; no real provider is added here (D-02/D-02b open). | As proposed. Reason: code-standards.md (versioned provider payloads), project rule 6. | Minhaj |
| R8 | Connection model and credentials | Routine | `IntegrationConnection`: tenant, provider key, connector version, label, optional brand (per Q3 answer), status (`active`, `disabled`, `needs_attention`), encrypted credentials blob with key id, encrypted webhook secret, created/updated by, `lastSuccessAt`, `lastErrorAt` and a short redacted error summary. Encryption: AES-256-GCM, random nonce, authenticated with tenant and connection id as associated data; master key from env `INTEGRATION_ENCRYPTION_KEY` (32 bytes, base64) with a key id so keys can rotate later (rotation procedure deferred to FEAT-045); the app refuses to start when the key is missing in production. Credentials are write-only: no endpoint returns them or any part of them (not even a masked tail); the API exposes only `hasCredentials` and `credentialsUpdatedAt`. If the platform generates a webhook secret/URL token, it is shown exactly once at creation. Log redaction list extended with credential field names. Losing the master key means reconnecting; the user provisions the production key as a host secret (never in the repo). | As proposed. Reason: "stored encrypted, never shown" in feature-list; AAD binds ciphertext to its record; rule 13. | Minhaj |
| R9 | Worker concurrency and fairness | Routine | Default worker concurrency 5; per-tenant cap 3 concurrent jobs so one tenant cannot starve others; claim batch small (10); graceful shutdown waits up to 25 s for running jobs; expired leases return jobs to `pending` (attempt counted). | As proposed. Reason: protects multi-tenant fairness; tunable via env. | Minhaj |
| R10 | Failure and recovery behaviour | Routine | Worker crash: leases expire, jobs retried (handlers idempotent). Poison messages: dead-lettered, never block the queue. Database unavailable: worker backs off and retries claiming; no job loss. Clock skew: lease and backoff use database time (`now()`). Missing/invalid `INTEGRATION_ENCRYPTION_KEY`: connection endpoints return a clear 503; webhook intake for unaffected data keeps working. | As proposed. Reason: workflow.md requires visible, replayable failure handling. | Minhaj |
| R11 | Connection settings UI (031.6) | Routine | "Integrations" settings page: list of connections (provider, label, status, last success, last error summary); add flow picks a provider from the registry (only the loopback appears in dev/test; in production the list is empty until real connectors exist) and renders credential inputs from the connector's field schema, all password-style and write-only; edit shows "Credentials saved" (never values) with a "Replace credentials" action; enable/disable; "Test connection" (calls `testConnection`, shows pass/fail with redacted reason); delete is deactivation only. All states designed (loading, empty, error, test running, permission denied via interim rule). | As proposed. Reason: generic UI works for whichever provider D-02/D-02b select. | Minhaj |
| R12 | Interfaces for later features | Routine | FEAT-031 exposes service methods (not routes) for FEAT-038: counts by state, oldest pending age, per-connection last success/failure, list dead jobs, replay, discard. HTTP routes and UI for them are FEAT-038. | As proposed. Reason: avoids overlap with FEAT-038. | Minhaj |
| R13 | Dependency on idempotency of domain posting | Routine | The framework guarantees at-least-once delivery and provides the inbox dedupe helper; idempotent posting of stock/sales stays in FEAT-012.3 and FEAT-025.3. | As proposed. Reason: keeps ledger invariants in the inventory features. | Minhaj |
| R14 | Test strategy | Routine | Unit tests for backoff, error classes, signature verification (including tampered body, wrong secret, expired timestamp), encryption (round trip, wrong AAD fails, tamper fails). Integration tests on the Neon test branch for atomic claim with competing workers, lease expiry, rollback of the outbox with the caller's transaction, duplicate webhook, stale event, dead-letter and replay, tenant isolation of every new table, and per-tenant fairness. E2E (Playwright) for the connection settings UI with the loopback connector. | As proposed. Reason: project rule 14 and code-standards.md test list (duplicate sync, webhook replay, tenant boundaries). | Minhaj |

Needed the user (answered 2026-10-12, all as recommended):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| Q1 | How long failed integration work retries before it needs a person, and who is told | Business | 8 attempts with exponential backoff (roughly 8 hours total), then dead-letter; dead items stay in a failure list (FEAT-038) with replay; no email/push alerting in this feature (in-app alerts come in the pilot-readiness stage) | 8 attempts with exponential backoff (about 8 hours), then dead-letter to a failure list with replay (FEAT-038). No email or push alerts in this feature (in-app alerts come in the pilot stage). | User, 2026-10-12 |
| Q2 | Retention of raw webhook payloads (they contain customer names, addresses, phone numbers) | Business | Keep full payload 30 days, then blank the payload and keep only metadata (ids, types, status, timestamps) for 12 months | Keep full webhook payloads 30 days, then blank the payload and keep metadata (ids, types, status, timestamps) for 12 months. | User, 2026-10-12 |
| Q3 | One or several connections per provider for a tenant (for example one online store per brand) | Business | Several allowed, each labelled and optionally linked to a brand; catalog/order mapping is per connection | Several connections per provider per tenant, each labelled and optionally linked to a brand; mapping is per connection. | User, 2026-10-12 |

**Requirements approved:** yes (2026-10-12)  <!-- Rabbi may start; FEAT-001 backend handoff exists -->

## Assignment (Minhaj)

**User outcome:** Online-channel features (catalog sync, order intake, courier) can be built on a reliable foundation: events and jobs that are never lost, retried safely, visible when they fail and replayable; authenticated, de-duplicated inbound webhooks; encrypted connection credentials; and a screen where an admin manages connections.

**Sub-features:** FEAT-031.1, FEAT-031.2, FEAT-031.3, FEAT-031.4, FEAT-031.5, FEAT-031.6

**In scope:** R1-R14 and answers Q1-Q3: transactional outbox, job queue and worker (two entry points), connector abstraction with a test-only loopback connector, inbound webhooks, retry/backoff/dead-letter with replay and discard service methods, consumer inbox dedupe, connection model with encrypted credentials, payload retention job, connection settings API and UI.

**Out of scope:** any real ecommerce, courier or payment provider (D-02, D-02b, D-08); catalog/order/stock logic that consumes events (FEAT-032+); failure list, health dashboard and replay routes/UI (FEAT-038); email/push alerting; production hosting choice and cron configuration; master-key rotation procedure (FEAT-045); user permissions beyond the interim owner/admin rule (FEAT-003).

**Sequencing:** Rabbi first. Shamim starts the connection settings page (031.6) after Rabbi's connection API handoff; Rabbi may hand off 031.1-031.5 and the connection API in two steps so the UI can start earlier. Tenant-agnostic utilities (backoff, signatures, encryption, connector interface) can be built first.

**Acceptance criteria:**
- AC-1: A migration adds outbox events, jobs, inbound events, consumer inbox and integration connections; all are tenant-owned (tenantId NOT NULL, composite keys, new models classified in the tenant-scope registry) except platform jobs, which use a nullable tenant; payload columns are JSONB with an explicit schema version; dev and test migrations apply, drift is clean.
- AC-2: `outbox.enqueue(tx, event)` writes inside the caller's transaction: an event enqueued in a rolled-back transaction does not exist; a committed one is delivered to the registered handler at least once; a dedupe key unique per tenant prevents a second event with the same key.
- AC-3: Events with the same ordering key are handled one at a time in order; a handler that fails does not block other keys.
- AC-4: Job claiming is atomic: with two workers competing for the same pending jobs, each job runs once; a worker crash (lease expiry, default 5 minutes) returns the job to pending and it runs again.
- AC-5: Before a handler runs, the tenant context is restored from the job or event row; the handler cannot read another tenant's data; platform jobs run without a tenant context.
- AC-6: One tenant cannot starve others: with one tenant holding many pending jobs, another tenant's job still starts promptly (per-tenant cap 3 concurrent, overall concurrency 5, both configurable).
- AC-7: `runDueWork({maxJobs,timeBudgetMs})` is exposed as an always-on worker (graceful SIGTERM drain, up to 25 s) and as `POST /internal/jobs/run` which is `@Public()`, authenticated by a constant-time secret check, returns 404 or 401 without the secret, and is disabled when the secret is unset.
- AC-8: Retries use exponential backoff with base 10 min, factor 2, cap 2 h, 0-20% jitter subtracted (`JOB_BACKOFF_JITTER` default 0.2) and a default of 8 attempts, so a job that always fails goes dead after 6 h 48 min to 8 h 30 min (tests assert this range with a controlled clock and random source); a retryable error reschedules, a non-retryable error goes straight to dead, a rate-limited error honours Retry-After; after the final attempt the job is dead with its payload, attempt count and redacted truncated error history kept.
- AC-9: Dead jobs can be listed and replayed (attempts reset, new run) or discarded through service methods; replay and discard are logged with actor, tenantId and correlationId; service methods also return counts by state, oldest pending age and per-connection last success/failure for FEAT-038.
- AC-10: Recurring work: `schedule(type, key, everyMs)` is idempotent (calling it twice leaves one schedule) and re-enqueues itself after each run.
- AC-11: The consumer inbox prevents a handler from applying the same (tenant, consumer, message id) twice, including under concurrent duplicate delivery.
- AC-12: Connector interface and registry: connectors declare provider key, connector version, credential field schema, event types, ordering strategy and rate limit; core code imports no provider code; the loopback test connector is registered only when NODE_ENV is development or test and is absent in production; payloads are parsed into versioned internal events.
- AC-13: Outbound calls go through the shared HTTP client: 10 s timeout, retry classification (network/5xx retryable, 4xx not), Retry-After handling, per-connection rate limit, redacted logging, and no outbound call runs inside a database transaction.
- AC-14: Webhook intake `POST /webhooks/:provider/:connectionId` is `@Public()` and authenticated only by signature: raw body kept for verification, constant-time compare, timestamp tolerance 5 minutes when the connector supplies a timestamp; unknown connection 404; missing or bad signature 401 with no detail; body over 1 MB returns 413; the tenant is taken from the connection, never from the payload.
- AC-15: A valid webhook is stored durably before the 2xx response and processed asynchronously through a job; a duplicate (same connection and external event id) returns 2xx without reprocessing; a stale event (older than the last applied for the same resource, per the connector's ordering strategy) is stored as ignored_stale and not applied; unsupported types are stored as ignored_unsupported; events for a disabled connection are stored as held, processed after re-enable and discarded after 7 days; replaying the same signed request later than the tolerance is rejected.
- AC-16: Connections: create, list, get, update label/brand, replace credentials, enable/disable, test connection; several connections per provider per tenant are allowed with a label unique per tenant and provider; an optional brand link must belong to the same tenant (cross-tenant brand rejected); there is no hard delete.
- AC-17: Credentials are encrypted with AES-256-GCM (random nonce, tenant and connection id as associated data, key id stored) using `INTEGRATION_ENCRYPTION_KEY`; they are write-only: no response, log or error contains a credential value or any part of it; the API shows only `hasCredentials` and `credentialsUpdatedAt`; a generated webhook secret is shown exactly once at creation; tampering with ciphertext or moving it to another connection fails decryption; the app refuses to start in production without the key and connection endpoints return 503 when it is missing in other environments.
- AC-18: Retention: a scheduled job blanks raw webhook payloads older than 30 days (metadata kept) and deletes inbound event metadata older than 12 months; tested with controlled clocks; configurable via env defaults.
- AC-19: Isolation: no tenant can read or change another tenant's connections, jobs, events or inbox rows through any endpoint or service method (shared isolation helper); every new raw SQL statement includes tenant scoping where it touches tenant data, with a test.
- AC-20: Connection settings UI ("Integrations" settings page): list with provider, label, status, brand, last success and last error; add flow lists providers from the registry (loopback only in dev/test, empty state in production) and renders password-style write-only credential inputs from the connector schema; edit shows "Credentials saved" with a Replace action and never shows values; enable/disable; Test connection with pass/fail and redacted reason; loading, empty, error, test-running and permission states; keyboard operable with labelled inputs; strings via i18n and theme tokens.
- AC-21: Playwright specs with the loopback connector cover add connection, two connections for one provider, replace credentials, test connection pass and fail, enable/disable, and that no credential value appears in the page, network responses or storage.
- AC-22: `pnpm turbo run lint typecheck build test`, `pnpm --filter api test:integration` and `pnpm --filter web test:e2e` pass; new dependencies are recorded in `context/Library-docs.md`; shared types live in `@ims/shared`; `.env.example` documents the new variables (names and placeholders only).

**Backend tasks (Rabbi):**
1. Choose and verify the queue approach (R1), record it in `Library-docs.md`; migration and Prisma models for outbox, jobs, inbound events, inbox and connections; register the new models in the tenant-scope registry; platform-level claiming uses the unscoped service and then restores tenant context.
2. Outbox service with the transactional enqueue helper, relay, ordering keys, dedupe keys and the inbox helper (AC-2, AC-3, AC-11).
3. Job worker: atomic claim, leases and heartbeat, per-tenant cap, graceful shutdown, `runDueWork`, worker entry point and the protected `/internal/jobs/run` route, scheduling (AC-4 to AC-7, AC-10).
4. Retry and dead-letter engine with typed errors, backoff, replay/discard and health-query service methods (AC-8, AC-9).
5. Connector interface, registry, shared HTTP client and the dev/test-only loopback connector (AC-12, AC-13).
6. Webhook intake with signature verification, durable store-then-ack, dedupe, stale/unsupported/held handling and the retention job (AC-14, AC-15, AC-18).
7. Credential encryption utility, connection service and endpoints (create, list, get, update, replace credentials, enable/disable, test), brand link validation, env var `INTEGRATION_ENCRYPTION_KEY` and `INTERNAL_JOBS_SECRET` in config validation and `.env.example`, log redaction additions (AC-16, AC-17).
8. Types in `@ims/shared`; unit tests and integration tests on the Neon test branch for every AC above (competing workers, lease expiry, rollback of outbox, duplicate/stale webhooks, tamper tests, isolation); fill the Backend handoff with the API contract. Hand off the connection API early if possible so Shamim can start.

**Frontend tasks (Shamim):** start after the connection API handoff.
1. "Integrations" settings page per R11 and AC-20, using the typed client and `@ims/shared` types; register new components in `context/ui-registry.md`.
2. Playwright specs per AC-21 with the loopback connector; fill the Frontend handoff.

**QA focus (Tanvir):** Delivery guarantees (rolled-back enqueue, duplicates, ordering, competing workers, lease expiry, per-tenant fairness); retry schedule and dead-letter then replay; webhook security (bad/missing signature, tampered body, replay beyond tolerance, oversized body, wrong connection, tenant taken only from the connection); duplicate, stale, unsupported and held events; credential secrecy everywhere (responses, logs, errors, UI, storage, network, DB column is not plaintext); encryption tamper and wrong-connection tests; missing key behaviour; the internal jobs endpoint without or with a wrong secret; retention with a mocked clock; isolation of every new table and method; loopback connector absent in a production configuration; the UI states and accessibility; clean-clone full command run. Report unspecified behaviour as a requirement gap.

## Backend handoff (Rabbi)

### EARLY — connection API (2026-10-12, for Shamim's 031.6 page)

Working and tested on the Neon test branch (`connections.int-spec.ts`, 13 tests pass). The rest of FEAT-031 (031.1-031.5) follows in the full handoff below. Branch `claude/FEAT-031-backend`; migration `20261012180000_integration_framework` is already applied to the shared `dev` and `test` branches.

**Types** (all from `@ims/shared`, file `packages/shared/src/integrations.ts`): `IntegrationProviderDto`, `CredentialFieldDto`, `IntegrationConnectionDto`, `IntegrationConnectionStatus` + `INTEGRATION_CONNECTION_STATUSES`, `IntegrationConnectionStatusFilter`, `ListIntegrationConnectionsQuery`, `IntegrationConnectionPage` (= `Page<IntegrationConnectionDto>`), `CreateIntegrationConnectionRequest`, `CreateIntegrationConnectionResponse`, `UpdateIntegrationConnectionRequest`, `ReplaceIntegrationCredentialsRequest`, `TestIntegrationConnectionResponse`, `IntegrationErrorCode`, `INTEGRATION_LIMITS`, `integrationWebhookPath()`.

**Auth:** every route needs the tenant context (dev: `x-tenant-id`, as in FEAT-001) and the interim tenant-admin capability (`@RequireTenantAdmin()` on the whole controller, also on GETs: only owner/admin manage connections). Errors use `ApiErrorBody`. Every route can return 401 `TENANT_CONTEXT_REQUIRED`, 403 `TENANT_SUSPENDED` / `TENANT_ADMIN_REQUIRED`. Every `/integrations/connections*` route returns **503 `INTEGRATION_KEY_UNAVAILABLE`** when the server has no `INTEGRATION_ENCRYPTION_KEY` (non-production only; production refuses to boot). `/integrations/providers` works without the key.

**Credentials are write-only.** No response ever contains a credential value or any part of it. Responses carry `hasCredentials` and `credentialsUpdatedAt` only. Validation errors name the field (`credentials.<key>`) and never echo the value.

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/integrations/providers` | none | 200 `IntegrationProviderDto[]` `{providerKey, displayName, connectorVersion, credentialFields:[{key,label,required,maxLength,description?}], supportedEventTypes, supportsWebhooks}`. dev/test: only `loopback` ("Loopback (test)", fields `apiKey` required, `baseUrl` optional). **production: `[]`** (show the empty state) | 401/403 |
| GET | `/integrations/connections` | query `status=active\|disabled\|needs_attention\|all` (default all), `providerKey`, `limit` 1-200 (default 50), `cursor` | 200 `IntegrationConnectionPage` `{items, nextCursor}`; sort label (case-insensitive) then id | 400 (bad status/limit/cursor), 503 |
| GET | `/integrations/connections/:id` | none | 200 `IntegrationConnectionDto` | 404 `NOT_FOUND` (unknown, malformed or other tenant: same body), 503 |
| POST | `/integrations/connections` | `{providerKey, label (1-100, trimmed), brandId? (uuid\|null), credentials: Record<string,string>}` | **201** `CreateIntegrationConnectionResponse` `{connection: IntegrationConnectionDto, webhook: {path, secret} \| null}`. **`webhook.secret` is shown exactly once** (copy-to-clipboard UI; it cannot be read again) | 400 `VALIDATION_FAILED` (details `label`, `brandId` "must be an active brand of this tenant", `credentials.<key>` unknown/required/too long/not a string); 400 `UNKNOWN_PROVIDER` (`providerKey`); 409 `DUPLICATE_VALUE` field `label` (unique per tenant + provider, case-insensitive); 503 |
| PATCH | `/integrations/connections/:id` | `{label?, brandId? (null removes the link)}` | 200 `IntegrationConnectionDto` | 400 (`credentials` -> "use PUT .../credentials", `status` -> "use enable/disable", `providerKey`/`id` "cannot be changed", bad brand); 404; 409 `DUPLICATE_VALUE` (`label`); 503 |
| PUT | `/integrations/connections/:id/credentials` | `{credentials: Record<string,string>}` (full replacement; required fields again) | 200 `IntegrationConnectionDto` (new `credentialsUpdatedAt`; status unchanged until the next test) | 400 (field details); 404; 409 `CONFLICT` if the provider is not available in this environment; 503 |
| POST | `/integrations/connections/:id/enable` | none | 200 `IntegrationConnectionDto` (`status:'active'`; idempotent; queues held webhooks) | 404, 503 |
| POST | `/integrations/connections/:id/disable` | none | 200 `IntegrationConnectionDto` (`status:'disabled'`; idempotent). This is the only "delete" | 404, 503 |
| POST | `/integrations/connections/:id/test` | none | 200 `TestIntegrationConnectionResponse` `{ok, reason: string\|null (redacted), testedAt, connection}`. A failed test is still HTTP 200 with `ok:false`. Success sets `lastSuccessAt` and `needs_attention -> active`; failure sets `lastErrorAt`/`lastErrorSummary` and `active -> needs_attention`; `disabled` stays disabled | 404, 503 |

No `DELETE` route (404 from the router).

`IntegrationConnectionDto` = `{id, providerKey, providerDisplayName, connectorVersion, label, brandId, status: 'active'|'disabled'|'needs_attention', hasCredentials, credentialsUpdatedAt, webhookPath (e.g. "/webhooks/loopback/<id>", not secret, prefix with the API base URL), lastSuccessAt, lastErrorAt, lastErrorSummary, createdAt, updatedAt}`.

**Loopback test connector behaviour (deterministic for Playwright):** `apiKey` of 8+ characters passes "Test connection"; an `apiKey` starting with `fail` gives `ok:false, reason:"Authentication failed (loopback test key)."`; shorter than 8 gives `"API key is too short."`. Leave `baseUrl` empty in the UI tests (it makes a real HTTP call to `<baseUrl>/ping`).

**Notes for Shamim:** render credential inputs from `credentialFields` (password-style, `autocomplete="off"`, never prefilled); edit view shows "Credentials saved" (`hasCredentials`) + `credentialsUpdatedAt` and a "Replace credentials" form that calls PUT; brand select from `GET /brands?status=active`; status filter uses `status`; "Load more" passes `nextCursor` as `cursor`; match errors on `code` and `details[].field`; treat 503 `INTEGRATION_KEY_UNAVAILABLE` as an explicit "integrations unavailable" state. Env for the API: `INTEGRATION_ENCRYPTION_KEY` (and `INTERNAL_JOBS_SECRET`) are now in the worktree's local `.env`/`.env.test`; the main folder's `.env` needs the same names (any 32-byte base64 key for dev) after merge, otherwise the page shows the 503 state.

### Full backend handoff (031.1-031.6 backend): done 2026-10-12

**Built:**
- **Migration** `packages/db/prisma/migrations/20261012180000_integration_framework/migration.sql`, applied to `dev` and `test`. Purely additive: new enums `integration_connection_status`, `work_status`, `inbound_event_status` and new tables `integration_connections`, `outbox_events`, `jobs`, `inbound_events`, `consumer_inbox`. No FEAT-001 table is altered. In `schema.prisma` only back-relation fields were added to `Tenant`/`Brand`, which are not SQL changes.
  - `tenant_id` is NOT NULL everywhere, except `jobs` where NULL marks a platform job.
  - Composite FKs `(tenant_id, connection_id)` on `jobs` and `inbound_events`. A trigger (`integration_connections_brand_tenant_chk`) keeps `brand_id` in the same tenant, because Prisma cannot model a composite FK whose columns are partly optional.
  - CHECKs: attempts/max_attempts 1-50, schema_version >= 1, error_history is an array, schedule >= 1 s, label not blank, ciphertext and key id set together.
  - Uniques: outbox `(tenant_id, dedupe_key)`; jobs `unique_key` = `<tenantId|platform>:<dedupeKey>` (one index that also covers platform jobs); inbound `(tenant_id, connection_id, external_event_id)`; inbox PK `(tenant_id, consumer, message_id)`; connections `(tenant_id, provider_key, label_key)`.
  - Indexes `(status, run_at)`, `(tenant_id, status)`, `(tenant_id, ordering_key, seq)`. Payloads are JSONB with `schema_version`.
  - Reversal SQL is in the migration header. All five models are registered as tenant-owned in `database/tenant-scope.ts`.
- **Queue decision (R1):** own Postgres implementation, no new dependency. It is recorded with reasons in `context/Library-docs.md` ("Job queue and outbox"). Claims use one short transaction: a transaction-level advisory lock serialises claimers, so per-tenant caps are exact, and `FOR UPDATE SKIP LOCKED` locks the rows. Nothing session-scoped is used, so it works on Neon's pooled PgBouncer (transaction mode); the competing-worker and lease tests ran on the pooled test-branch URL. pg-boss was rejected: its own schema and migrations sit outside Prisma, there is no tenant column or per-tenant cap, and its LISTEN/NOTIFY and maintenance need care with the pooler.
- **Code** (`apps/api/src/integrations/`):
  - `core/` holds only the framework and imports no provider code (a test checks this):
    - `outbox.service.ts`: `enqueue(tx, event)`.
    - `job-queue.service.ts`: `enqueue(tx?, job)`, `schedule(type, key, everyMs)`.
    - `inbox.service.ts`: `runOnce(tx, consumer, messageId, apply)`.
    - `work-registry.ts`: job, outbox and platform-schedule handlers.
    - `work-errors.ts`: `RetryableError`, `RateLimitedError`, `NonRetryableError`, Retry-After parsing.
    - `backoff.ts`: full jitter, base 30 s, factor 2, cap 1 h, floor 1 s.
    - `redact.ts` (500 chars), `credential-cipher.ts` (AES-256-GCM, AAD = tenant:connection:purpose, key id `k1-<sha256 prefix>`), `signature.ts` (constant-time compare, `t=,v1=` HMAC with 5 min tolerance).
    - `connector.ts` + `connector-registry.ts`: the interface and registry.
    - `http-client.ts`: `ConnectorHttpClient` with a 10 s timeout, classification, Retry-After, a per-connection token bucket and redacted logs. It refuses to call out inside a transaction.
    - `inbound-events.ts`: processing job, stale check, `InboundEventHandlerRegistry`.
    - `integration-settings.ts`: env tunables and the cipher; 503 when the key is missing.
  - `platform/` is allow-listed for unscoped Prisma in `eslint.config.mjs` and `unscoped-prisma.spec.ts`:
    - `work-store.ts`: raw SQL claim, heartbeat, succeed, fail and connection health. Every row-level statement filters `tenant_id`.
    - `work-runner.service.ts`: `runDueWork`, which restores the tenant context per row. `worker-loop.ts`: polling, DB-error backoff, 25 s drain.
    - `internal-jobs.controller.ts`, `webhook.controller.ts`, `webhook-intake.service.ts`, `raw-body.middleware.ts`, `retention.service.ts`, `platform-job-queue.ts`.
  - `connections/`: controller, service and DTOs (see EARLY contract above). `ops/integration-ops.service.ts`: R12 methods. `connectors/connectors.provider.ts` + `connectors/loopback/loopback.connector.ts`: the dev/test-only loopback connector. `integrations.module.ts`.
  - `src/worker.ts`: always-on worker entry, run with `pnpm --filter api worker` (build first).
- **Shared types:** `packages/shared/src/integrations.ts` (listed in the EARLY section). `@ims/db` exports the new model types and enums.
- **Changed existing files:**
  - `app.module.ts`; `configure-app.ts` (raw body for `/webhooks`); `config/env.validation.ts` (new vars, production key rule, empty means unset).
  - `common/errors/error-codes.ts`; `database/tenant-prisma.service.ts` (transaction marker); `database/tenant-scope.ts`.
  - `tenancy/mutation-log.service.ts` (new entities/actions); `testing/tenant-fixtures.ts` (cleanup of new tables).
  - `vitest.config.ts` (fixed non-secret unit key, coverage excludes `worker.ts`); `vitest.integration.config.ts` (fallback test values when env is absent, e.g. CI).
  - `apps/api/package.json` (`worker` script); `turbo.json` (new env names for `test:integration` and `dev`); `eslint.config.mjs`; `.env.example`.

**API contract (besides the connection API in the EARLY section):**

| Method | Path | Request | Response | Errors | Auth |
|---|---|---|---|---|---|
| POST | `/webhooks/:provider/:connectionId` | Raw body, any content type, at most 1 MB. Loopback: header `x-loopback-signature: t=<unix s>,v1=<hex HMAC-SHA256(secret, "t.body")>`. Body `{id, type, resource?, sequence?, occurredAt?, data?}` | **200** `{received:true}`. Returned after the event is stored, and also for duplicates, held and unsupported events | 404 `NOT_FOUND` (unknown/malformed connection, provider mismatch, provider not registered); **401 `UNAUTHORIZED` "Unauthorized"** for a missing, wrong, tampered or expired (>5 min) signature, with no detail; 413 `PAYLOAD_TOO_LARGE`; 400 `BAD_REQUEST` (signed but unparseable); 503 if the key is missing | `@Public()` + connector signature. The tenant comes from the connection only |
| POST | `/internal/jobs/run` | Header `Authorization: Bearer <INTERNAL_JOBS_SECRET>`. Optional body `{maxJobs? 1-500 (default 100), timeBudgetMs? 1000-55000 (default 25000)}` | 200 `{claimed, succeeded, retried, dead, leaseLost, expiredLeases, durationMs, stoppedBy: 'idle'\|'max_jobs'\|'time_budget'\|'stopped'}` | **404** when the secret is unset (route disabled); **401** for a missing or wrong secret (checked in constant time by a guard that runs before body validation); 400 for a bad body | `@Public()` + secret guard; no tenant context |

**Service methods for later features (no routes):**
- `OutboxService.enqueue(tx, {eventType, aggregateType, aggregateId, payload, schemaVersion?, dedupeKey?, orderingKey?, maxAttempts?})` returns `{id, duplicate}`.
- `JobQueueService.enqueue(tx|undefined, {type, payload, runAt?, dedupeKey?, orderingKey?, connectionId?, maxAttempts?})`; `JobQueueService.schedule(type, key, everyMs)`.
- `PlatformJobQueue.enqueue/schedule` for platform jobs.
- `InboxService.runOnce(tx, consumer, messageId, apply)`.
- `WorkHandlerRegistry.registerJob({type, handle, onDead?})` / `registerOutbox({eventType, consumer, handle})` / `registerPlatformSchedule`.
- `InboundEventHandlerRegistry.register({providerKey, eventType, handle(event, tx, ctx)})`.
- `WorkRunner.runDueWork({maxJobs, timeBudgetMs, shouldStop?})`.
- FEAT-038 (R12, tenant-scoped): `IntegrationOpsService.counts()`, `oldestPendingAgeMs()`, `connectionHealth()`, `listDead({kind?, limit?})`, `replay(kind, id)`, `discard(kind, id)`. Replay and discard log `{actor, tenantId, entity: job|outbox_event, entityId, action, correlationId}`. Foreign or unknown id gives 404; an item that is not dead gives 409.

**Behaviour summary:**
- At-least-once delivery. Each claim increments `attempts`. Lease 5 min with a heartbeat every lease/3. An expired lease goes back to pending, or to dead on the final attempt (attempt counted).
- Per-tenant cap 3 across jobs and outbox together; platform jobs form one group. Concurrency 5, claim batch 10. Claims go oldest-first per tenant, round-robin across tenants.
- Ordering key: only the first unfinished item of a key is claimable. A `dead` item blocks its key until it is replayed or discarded.
- Recurring jobs re-arm after a successful run for `now() + every` with attempts reset.
- Errors are stored redacted and truncated (500 chars); the history keeps the newest 20 entries.
- Unknown job type: dead (non-retryable). Inbound processing that is dead-lettered marks the event `failed`.
- Job success or failure with a `connectionId` updates `lastSuccessAt` or `lastErrorAt`/`lastErrorSummary`.
- Retention is a platform job scheduled daily (ensured on the first `runDueWork`), one tenant per statement: delete metadata older than 365 days, discard held events older than 7 days, blank payloads older than 30 days (sets `payload_purged_at`).

**Env vars (names only; see `.env.example`):** `INTEGRATION_ENCRYPTION_KEY` (32-byte base64; required in production), `INTERNAL_JOBS_SECRET` (32+ chars; unset means the route is off), and the optional tunables `WORKER_CONCURRENCY` (5), `WORKER_TENANT_CAP` (3), `JOB_MAX_ATTEMPTS` (8), `JOB_BACKOFF_BASE_MS` (30000), `JOB_BACKOFF_CAP_MS` (3600000), `JOB_LEASE_MS` (300000), `WEBHOOK_PAYLOAD_RETENTION_DAYS` (30), `INBOUND_EVENT_RETENTION_DAYS` (365), `WEBHOOK_HELD_MAX_DAYS` (7). Dev/test-only values of the two secrets were generated and appended to the worktree's git-ignored `.env` and `.env.test`; they were not printed. **Production values are the user's job (host secrets).**

**Unit tests:** command / result (2026-10-12, worktree `D:\app\ims-feat-031`)
- `pnpm install --frozen-lockfile`: pass. No dependency was added, so the lockfile is unchanged.
- `pnpm turbo run lint typecheck build test --force`: **15/15 tasks pass**. api unit: **312 passed** (22 files; 53 new FEAT-031 tests in `core-utils.spec.ts`, `http-client.spec.ts`, `connectors.spec.ts`, `integrations-http.spec.ts`, `work-runner.spec.ts`, plus env tests). @ims/db: 16 passed. api unit coverage fell to 69% statements because the DB-heavy services are covered by the integration suite.
- One earlier full turbo run had a transient failure: a spec that boots AppModule after `vi.resetModules` (8 tests skipped, most likely `tenant-guard.production.spec.ts`) hit the 10 s hook timeout under parallel lint/build load. Unit `hookTimeout`/`testTimeout` are now 30 s in `apps/api/vitest.config.ts`, and the full run passed again (15/15).
- `pnpm format:check`: pass.
- `pnpm --filter api test:integration` (Neon test branch): **64 passed** in 6 files: 27 existing, plus `connections.int-spec.ts` 13, `platform/work-engine.int-spec.ts` 14 and `platform/webhooks.int-spec.ts` 10.
- DB: `db:migrate:deploy` (dev) and `db:migrate:deploy:test` applied the migration. `db:status` and `db:status:test` report "Database schema is up to date!". Drift on dev and test: "No difference detected."
- Live (`node dist/main.js`, Neon test branch, `NODE_ENV=test`, port 3031; demo tenants A/B):
  - Create gave 201 with `hasCredentials:true`. The apiKey was absent from the create, GET and list responses, and the webhook secret was absent from GET.
  - Test connection: 200 `ok:true`. Tenant B on A's connection (GET, test, disable): 404 `NOT_FOUND`.
  - Webhooks: good signature 200 `{received:true}`, then the event became `processed` after the trigger ran. Duplicate: 200 with one row. Bad, missing, tampered and replayed (signed 10 min ago) signatures: 401 "Unauthorized". 1.1 MB body: 413 `PAYLOAD_TOO_LARGE`. Unknown connection: 404.
  - `/internal/jobs/run`: no secret 401, wrong secret 401, correct secret 200 `{"claimed":1,"succeeded":1,...,"stoppedBy":"idle"}`.
  - Logs contained no `whsec_`, no apiKey, no connection string and no internal secret. The rejected-webhook log lines carry only the reason (`invalid`/`missing`/`expired`).
  - `node dist/worker.js` started (`Worker <host:pid:id> started`) and processed a newly received webhook event, which became `processed`.
  - `NODE_ENV=production` without the key: exit 1 with "INTEGRATION_ENCRYPTION_KEY is required when NODE_ENV is production".

**Limitations:**
- Graceful SIGTERM drain is covered by unit tests (`WorkerLoop.stop`), not by a live signal: Windows does not deliver SIGTERM to a background node process.
- The candidate query ranks all due pending rows (a window function), and one claim transaction runs at a time across workers. That is fine at pilot scale; revisit for large backlogs.
- Sequence numbers (`seq`) are assigned at insert, not commit. Ordering is exact for writes to the same aggregate, which are serialised by the caller's row locks. Concurrent producers on one ordering key without such a lock could be reordered.
- Succeeded jobs and outbox rows are never purged. A cleanup can join the retention job later (FEAT-038/045).
- There is no webhook-secret rotation endpoint (the secret is shown once at creation). Master-key rotation is FEAT-045. The key id is stored, and a different key gives a clear decryption error ("replace credentials").
- `POST /internal/jobs/run` is POST only. Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`, so the deployment feature must add a GET alias or a small proxy.
- The connector HTTP client blocks outbound calls only inside transactions opened through `TenantPrismaService.transaction` or the platform store. A raw `client.$transaction` is not marked.
- Rate-limited errors (429) consume an attempt.
- In dev the shared `dev` branch now has this migration. The main folder (FEAT-001 UI work) will show it as "not found locally" in `db:status` and as drift until FEAT-031 is merged. That is expected and harmless.

**Choices for Minhaj to confirm (routine, reversible):**
1. **R5 vs Q1 timing mismatch.** With R5's values (base 30 s, factor 2, cap 1 h, 8 attempts) the longest total wait before dead is about 64 min, and about 32 min on average with full jitter, not "about 8 hours" as Q1 states. I implemented R5/AC-8 exactly and made it env-tunable. For roughly 8 h, use for example `JOB_BACKOFF_BASE_MS=300000` and `JOB_BACKOFF_CAP_MS=14400000` (about 9 h worst case, about 4.6 h average). Please decide which values are authoritative.
2. Added inbound status `discarded` for held events older than 7 days. R6 lists no state for that case.
3. A `dead` item blocks later items with the same ordering key until it is replayed or discarded (strict order).
4. A brand link must be an active brand. Unknown, other-tenant and inactive brands all get the same 400 `brandId`.
5. Connection GET routes also require the interim tenant-admin capability ("only owner/admin manage connections").
6. Test connection moves `active` to `needs_attention` on failure and back to `active` on success. Replacing credentials does not change status. Disabled stays disabled.
7. Every `/integrations/connections*` route answers 503 without the key. `/integrations/providers` does not.
8. Webhook acknowledgments are always `200 {received:true}`, with no outcome detail for the provider.

**Notes for Shamim:** see the EARLY section (contract, loopback test keys, states). Additions: the webhook secret is in `CreateIntegrationConnectionResponse.webhook.secret` and only there; show it once with a copy action and a clear "you will not see this again" message. `webhookPath` is relative to `NEXT_PUBLIC_API_URL`. After merge, add `INTEGRATION_ENCRYPTION_KEY` (any 32-byte base64 for dev) to the main folder's `.env`, or the page will show the 503 state. Run the API with `NODE_ENV=development` + `ALLOW_DEV_TENANT_HEADER=true` as for FEAT-001.

**Notes for Tanvir:**
- Integration suites to reuse:
  - `connections.int-spec.ts`: CRUD, secrecy, ciphertext at rest, tamper and move, brand trigger, isolation probes.
  - `platform/work-engine.int-spec.ts`: rollback, dedupe, ordering, competing workers, lease expiry (also on the final attempt), tenant context, fairness, schedule, retry/dead/replay/discard, Retry-After, tenant-filtered SQL, concurrent inbox, internal route.
  - `platform/webhooks.int-spec.ts`: signatures, replay, 404/413/400, duplicate, stale, unsupported, held/enable/discard, failed, retention with a controlled clock.
- Runs are restricted with `runDueWork({tenantIds})` so other data on the branch is untouched. Platform claims (no filter) also run the daily retention job across all tenants.
- Missing-key 503, route 404 with the secret unset, and loopback absent in production are covered in `integrations-http.spec.ts` (boots with a changed env).
- The production refusal to boot: `env -u INTEGRATION_ENCRYPTION_KEY NODE_ENV=production node dist/main.js` exits 1.
- To sign a loopback webhook by hand, use `signTimestamped(secret, body)` from `core/signature.ts`, or the HMAC recipe in the contract.
- Raw SQL added by FEAT-031: `work-store.ts` (claim is cross-tenant by design; every row statement filters `tenant_id`, tested in "row-level platform SQL is tenant-filtered"), `retention.service.ts` (per tenant), and the `jobs`/`inbound` helpers in tests. Please re-check that standing rule.

### FI-1 resume verification (Codex, Rabbi role, 2026-10-12)

Preserved and reviewed Claude's interrupted changes on `codex/FEAT-031-resume`. Retry defaults and jitter now match the approved revised R5/AC-8: 10-minute base, factor 2, 2-hour cap, eight attempts and 20% bounded jitter. Environment validation rejects jitter outside 0-1; explicit test configuration keeps schedule assertions independent of developer settings. No schema or dependency change is required.

Checks so far: `pnpm --filter api test:unit` passed 316 tests in 22 files; API lint, build and typecheck passed. Guarded test-branch integration retest and full-feature QA follow the frontend handoff; final results will be recorded below.

FI-1 backend correction is complete: the full 64-test framework integration suite passed in independent QA. BUG-008..010 fixes passed four new unit validation tests and all six independent connection input regressions on the guarded test branch. Full combined-source retest follows consolidation with FEAT-001.

## Minhaj review of backend handoff (2026-10-12)

Reviewed against commit 2a55e4f on branch `claude/FEAT-031-backend`. One fix item for Rabbi (below); everything else is confirmed. Nothing needs the user: the retry mismatch is resolved in favour of the user's own Q1 answer ("about 8 hours").

| # | Item | Decision | Reason |
|---|---|---|---|
| 1 | Retry timing: original R5/AC-8 values gave only about 64 min worst case, not the user's "about 8 hours" | **Changed; fix item FI-1 for Rabbi** | The user's answer wins. New defaults base 10 min, factor 2, cap 2 h, 8 attempts, jitter 0-20% subtracted: nominal waits 10, 20, 40, 80, 120, 120, 120 min = 8 h 30 min; actual total 6 h 48 min to 8 h 30 min, about 7 h 40 min on average. A smaller jitter than full jitter is used so the total stays near 8 h instead of collapsing toward half of it; 20% is still enough to spread retries. Attempts stay at 8 (7 waits fit the schedule), so no attempt-count change is needed. R5, AC-8 and the tracker decision are updated. |
| 2 | New inbound status `discarded` for held events older than 7 days | Confirmed | Needed to represent R6's 7-day rule honestly; R6 state list updated. Metadata is kept per the 12-month retention answer. |
| 3 | A dead item blocks later items with the same ordering key until replayed or discarded | Confirmed | Strict order is the safe default (skipping a failed event could apply a later one out of sequence). FEAT-038 must show blocked items next to the dead one so an admin sees why work is stuck; noted in the tracker follow-ups. |
| 4 | A connection's brand link must be an active brand (same 400 for unknown, foreign and inactive) | Confirmed | Avoids new links to retired brands and does not leak other tenants' brands. An existing link is not changed if the brand is deactivated later. |
| 5 | GET connection routes also require the interim admin capability | Confirmed | Only owner/admin manage connections (R-decision); connection health details are not for every user. FEAT-003 replaces the interim rule. |
| 6 | 429 (rate limited) responses consume an attempt | Confirmed | Simple and bounded; with the 8 h schedule a rate-limited job is still retried over hours and Retry-After is honoured as the minimum wait. Revisit only if a real provider's limits cause dead-letters (FEAT-032/033). |
| 7 | `POST /internal/jobs/run` is POST only; Vercel Cron uses GET | Accepted now; tracked | Hosting is decided later. The deployment work must add a GET alias or a small proxy that calls the POST with the secret. Recorded in the tracker follow-ups (owner: whoever implements deployment, assigned in the FEAT-045 requirement review since build-plan stage 2 lists basic deployment). |
| 8 | Test connection toggles `active` and `needs_attention`; replacing credentials leaves status unchanged | Confirmed | Status reflects the last test, not an assumption. |
| 9 | Connection routes answer 503 without the encryption key; providers list does not | Confirmed | Clear failure without leaking anything. |
| 10 | Webhook acks are always `200 {received:true}` | Confirmed | Does not reveal outcomes to a caller. |
| 11 | Finished jobs and outbox rows are never purged | Accept now; tracked | Not a correctness issue at pilot scale. Cleanup (delete succeeded rows older than 30 days) is added to the retention job in the FEAT-045 requirement review, before pilot. Tracker follow-up. |
| 12 | No webhook-secret rotation endpoint | Accept now; tracked | The secret can be replaced by creating a new connection. Per-provider rotation is decided in the FEAT-032 requirement review once the first provider (D-02) is known; master-key rotation is FEAT-045. Tracker follow-up. |
| 13 | Other limits: SIGTERM drain not tested live on Windows; one claim at a time across workers; `seq` assigned at insert; HTTP client only blocks calls inside TenantPrismaService/platform transactions; unit coverage 69% | Accepted | Pilot-scale and documented; QA to include a live-signal check on Linux CI; unit coverage is complemented by 64 integration tests. |

**Fix item for Rabbi (FI-1, backend, small, no schema change):**
1. Change the defaults in the backoff code and env config to: `JOB_BACKOFF_BASE_MS=600000` (10 min), `JOB_BACKOFF_CAP_MS=7200000` (2 h), factor 2, `JOB_MAX_ATTEMPTS=8` (unchanged), and add `JOB_BACKOFF_JITTER=0.2` (fraction 0-1, validated; wait = nominal * (1 - jitter * random), instead of full jitter; keep a floor of 1 s). Update `.env.example`, `vitest` configs and the comment in `backoff.ts`.
2. Update `Library-docs.md` and the unit tests: nominal waits 600, 1200, 2400, 4800, 7200, 7200, 7200 s; with random = 0 the total is 30,600 s (8 h 30 min), with random = 1 it is 24,480 s (6 h 48 min); integration tests that relied on the old defaults pass their own explicit values.
3. Re-run `pnpm turbo run lint typecheck build test` and `pnpm --filter api test:integration`; record the new numbers in the Backend handoff (add a "FI-1 done" line). No re-QA of other items is needed beyond Tanvir checking AC-8 against these numbers.

## Frontend handoff (Shamim)

**Built (resumed by Codex, 2026-10-12):** Preserved and completed Claude's interrupted FEAT-031.6 UI. `/integrations` and the primary navigation link use the existing tenant gate, typed API client, shared DTOs, form/state primitives, i18n and theme tokens. The connection list shows provider, label, status, brand, last success and last error, with status filtering and cursor paging. Add selects providers from the registry and renders schema-driven password inputs; edit shows write-only credential status and a replacement form. Test connection displays pending/pass/fail states and redacted reasons. Enable/disable uses confirmation. Creation shows the webhook URL and secret once with copy/manual fallback and explicit dismissal; no credentials are persisted in browser storage. New components are registered in `ui-registry.md`.

Fixed two frontend edge cases: unchanged brand links are omitted from PATCH requests so label edits preserve an inactive linked brand; denied list loads hide management actions and stale rows. The keyboard spec waits for provider controls to finish loading before Tab.

**Playwright:** `apps/web/e2e/integrations.spec.ts` (17 fake-API tests mapped to AC-20/21), with `helpers/fake-integrations-api.ts`. PowerShell command: `$env:E2E_PORT='3121'; Remove-Item Env:E2E_SEED -ErrorAction SilentlyContinue; pnpm --filter web test:e2e -- integrations.spec.ts organization.spec.ts smoke.spec.ts` — **42 passed** (17 integrations, 21 organization, 4 smoke; 30.6 s). The test server builds the production web app with the interim dev tenant capability. `pnpm --filter web lint`, `pnpm --filter web typecheck`, and `pnpm --filter web build` passed. No new dependencies.

**Notes for QA:** Browser tests cover creation/two same-provider connections, duplicate-label/server errors, brand edits, inactive-brand preservation, required credential validation, credential replacement/secrecy across DOM/inputs/responses/storage, test success/failure/running, disable/enable, one-time webhook dismissal/reload, empty/no-provider, missing key, loading/network/retry, tenant absence, permission denied, vanished connection and keyboard controls. These tests use the loopback API contract via mocks; live loopback browser QA remains for Tanvir on the Neon test branch. This frontend run did not seed or access any database. Real backend enforcement and credential encryption are verified separately by backend integration tests. An earlier combined run was interrupted after a concurrent standalone build replaced its server artifacts; the final sequential run above is clean. Production has no connector until a provider feature registers one. FEAT-002/003 still replace the interim owner/admin capability; technical details remain limited to this admin page.

## QA report (Tanvir)

**Commands run / results:**

Final independent QA against consolidated commit `053e6bf` plus the live-browser test additions, 2026-10-12. Database checks used only the guarded Neon test branch. Existing developer servers were preserved; dedicated test servers used ports 3011/3111 and were stopped afterward.

| Check | Result |
|---|---|
| `pnpm turbo run lint typecheck build test --output-logs=errors-only` | 15/15 tasks pass; API 383 unit tests in 24 files; DB 16 unit tests |
| `pnpm --filter api test:integration` | 170 passed in 10 files, no expected failures |
| `NEXT_PUBLIC_API_URL=http://localhost:3011 E2E_PORT=3111 pnpm --filter web test:e2e` | 74 passed, 0 skipped; fresh production web build |
| Web lint/typecheck after live QA additions | Pass |
| Formatting and whitespace checks | Pass |

New independent coverage: `apps/api/src/qa/integration-connections-qa.int-spec.ts` (six input-boundary tests) and `apps/web/e2e/qa/integrations-real-api-qa.spec.ts` (three real browser/API loopback flows). The browser fixture passes the integration encryption key privately to its API subprocess. Real flows cover multiple connections to one provider, credential replacement, failed-test recovery, enable/disable, tenant isolation and credential secrecy in responses, DOM/form values and storage after submission. The one-time generated webhook secret is the intentional reveal exception. Four created test connections were disabled in cleanup.

| AC | Result | Notes |
|---|---|---|
| AC-1 | PASS | Schema/migration and prior dev/test drift evidence retained; no new schema changes in resume |
| AC-2, AC-3 | PASS | Transaction rollback, outbox dedupe and ordered delivery integration checks |
| AC-4, AC-5, AC-6 | PASS | Competing workers, leases, tenant fairness and restored context |
| AC-7 | PASS | Worker drain unit checks and protected internal trigger; live Linux signal check remains operational follow-up |
| AC-8, AC-9, AC-10 | PASS | FI-1 bounded schedule, retry/dead/replay/discard and recurring scheduling |
| AC-11, AC-12, AC-13 | PASS | Concurrent inbox dedupe, connector registration and shared HTTP client |
| AC-14, AC-15 | PASS | Signature/raw-body security, durable intake, duplicates, stale/held/unsupported events |
| AC-16 | PASS | Connection operations plus BUG-008..010 input regressions |
| AC-17, AC-18, AC-19 | PASS | Encryption/tamper and secrecy, controlled retention, tenant-scoped access |
| AC-20, AC-21 | PASS | Seventeen mock UI tests plus three independent real loopback browser tests |
| AC-22 | PASS | Full command set, shared types and documented environment configuration; no new dependencies |

**Bugs found:**

BUG-008..010 were reproduced as five ordinary failing cases, fixed by Codex in the Rabbi role and independently verified in the final suite. No remaining application defects found. Full eight-attempt timing is established by controlled-random unit schedule proofs combined with database transition checks; the shorter database exhaustion fixture uses explicit three-attempt settings. Live Linux SIGTERM verification remains a deployment/CI follow-up, as accepted in the backend review. Replay/discard log fields were reviewed statically. Provider features and production hosting remain separate approved-scope follow-ups.

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
| BUG-008 | NUL in connection label returns 500 | Backend | Codex (Rabbi role) | Shared NUL validator on create/update labels; regression covers both endpoints | Closed (QA verified) |
| BUG-009 | Null connection label returns 500 | Backend | Codex (Rabbi role) | Validate supplied labels including null; preserve omission and nullable brandId semantics | Closed (QA verified) |
| BUG-010 | Unsafe decoded connection cursor returns 500 | Backend | Codex (Rabbi role) | Validate UUID and NUL-free label key before database query | Closed (QA verified) |
| BUG-011 | Recovered lease timestamp can round ahead of transaction now() | Backend | Codex (Rabbi role) | Truncate recovery run_at to milliseconds so it is due in the same claim; independent 14-case worker retest passes | Closed (QA verified) |

### Resume triage (Codex, Minhaj role, 2026-10-12)

Tanvir independently reproduced BUG-008..010 on the test branch (five failing regression cases, one passing nullable-brand case). These are boundary-validation defects under approved AC-16/AC-22, requiring no new business decisions. Assigned to Codex in the Rabbi role and fixed without schema/dependency changes. Regression suite: `apps/api/src/qa/integration-connections-qa.int-spec.ts`. Final retest and closure follow below.

### Closure (Codex, Minhaj role, 2026-10-12)

Resumed Claude's backend fix item and frontend work from `D:/app/ims-feat-031`, preserved the existing implementation, completed the UI handoff, corrected validation defects and consolidated it with closed FEAT-001 into the primary workspace. All 22 criteria have passing evidence; all feature bugs are verified and closed. FEAT-031.1-.6 are Done. Next dependency-ranked feature is FEAT-002 Authentication and user management, beginning with Minhaj's requirement review; it is not assigned for implementation yet.

### Regression triage (2026-10-13)

Authentication regression checks exposed BUG-011: lease recovery writes now() into a millisecond-precision timestamp, which can round forward beyond the same transaction's unrounded clock. The following due-work query then misses the recovered job. Guarded read-only SQL confirmed forward rounding in seven of ten observations. Root/Codex (Rabbi role) changed recovery run_at to date_trunc('milliseconds', now()). Both initially failing checks and the full 14-case work-engine suite pass. FEAT-031.2 is reopened for independent Tanvir verification.

The fairness test also depended on 150ms handlers reaching an exact concurrency peak despite database latency. It now holds the first eligible wave behind a promise barrier and retains its cross-tenant and maximum-cap assertions. A bounded watchdog prevents a broken test from hanging cleanup; it starts only after fixture enqueueing. No fairness policy changed.

### Independent BUG-011 retest (Codex, Tanvir role, 2026-10-13)

Reviewed both job/outbox recovery SQL and the fairness fixture correction. Truncation makes recovered work due against the same transaction clock without changing final-attempt dead-letter handling, tenant filtering or fairness policy. The barrier retains cross-tenant admission and concurrency-cap assertions; its watchdog starts after fixture enqueueing and releases during cleanup.

After Rabbi's full integration run released the shared test branch, ran `pnpm --filter api test:integration -- src/integrations/platform/work-engine.int-spec.ts`: **14/14 passed**, one file, 33.50 seconds. The global setup verifies the actual database branch identity and refuses non-test targets; fixtures provision unique tenants and remove their owned rows. AC-4/AC-6 recovery, final-attempt dead-lettering, competing workers and tenant fairness all pass alongside the remaining worker regression checks. No additional defects found. BUG-011 is Verified; FEAT-031.2 QA is Done. Final regression closure belongs to Minhaj.
