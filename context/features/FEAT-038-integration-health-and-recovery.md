# FEAT-038: Integration health and recovery

Status: Requirements - Minhaj (answers accepted 2026-10-14; pending human approval of review and estimates)

## Requirement review (Minhaj)

**Sub-features:** FEAT-038.1 Integration health dashboard, FEAT-038.2 Failed event list and replay, FEAT-038.3 Stock drift reconciliation

**Dependencies done:** FEAT-031 (Done 2026-10-13): outbox, jobs, inbound events, dead-letter, connection health fields and the tenant-scoped `IntegrationOpsService` (`counts`, `oldestPendingAgeMs`, `connectionHealth`, `listDead`, `replay`, `discard`) already exist with no routes. FEAT-001/002 Done. FEAT-003 is merged but not closed: use the interim `@RequireTenantAdmin()` guard now and swap to the FEAT-003 permission when it closes. FEAT-004 (audit log) is not built: replay/discard stay as structured logs as FEAT-031 built them; retrofit to the audit table when FEAT-004 lands.

**Dependency finding (038.3):** drift reconciliation needs a provider that can read channel stock (FEAT-032, which waits on D-02) and system availability (FEAT-012/FEAT-017). `feature-list.md` lists only FEAT-031. 038.1 and 038.2 are fully buildable now with the loopback connector. 038.3 cannot be built or tested against a real channel until FEAT-032 exists, so it should be deferred (Q5).

**Sources checked:** `feature-list.md` (FEAT-038 rows), `feature-progress-list.md`, `features/FEAT-031-integration-framework.md` (R5 retry, R10 failure behaviour, backend handoff "FEAT-038 (R12)" methods, behaviour summary, retention), `progress-tracker.md` (Q1 decision: 8 attempts about 8 h then dead-letter with replay, no email/push; follow-up (d): show items blocked behind a dead item with the same ordering key), `architecture.md` (Integrations, Transaction boundaries), `build-plan.md` stage 5 (integration drift verification), `ui-rules.md`, existing code `apps/api/src/integrations/ops/integration-ops.service.ts` and `apps/web/src/app/integrations/`.

**Gap checklist:**
- [x] User roles and permissions: only owner/admin today (interim). Q1.
- [x] Business rules and policies: health thresholds (Q3), discard policy (Q2), drift policy (Q5), bulk replay (Q4).
- [x] Data fields, validation, uniqueness: no new tables for 038.1/038.2. Drift run results (038.3) need a table, designed after Q5. Discard reason max 500 chars.
- [x] States and transitions: dead -> pending (replay, attempts reset), dead -> discarded; replay of a non-dead item gives 409 (already built). Failed inbound events shown with their job.
- [x] Failure, edge and concurrency cases: two admins replay the same item (second gets 409, no double run); replay while an ordering-key head is dead (replay head first; UI shows blocked count, FEAT-031 follow-up d); replay after the connection is disabled (item re-queues but waits until enabled, UI says so); provider no longer registered.
- [x] Tenant and location scope: tenant-scoped only; foreign id returns 404 (built). No location scope (integrations are tenant/brand level).
- [x] Money / tax / timezone: none. Times shown in tenant business timezone (FEAT-042 formatter when available).
- [x] Audit needs: replay/discard logged with actor, tenant, entity, correlation id (built); audit table later via FEAT-004.
- [x] UI screens and flows: extend `/integrations` with a Health section per connection (status, last success, last error, lag, pending/dead counts) and a Failed items list with replay/discard confirmation; loading/empty/error/forbidden states per `ui-rules.md`; register new components in `ui-registry.md`.
- [x] Integrations: loopback connector only until D-02; no real provider calls in 038.1/038.2.
- [x] Open decisions: none formal (D-02 only affects 038.3 testing).

**Gaps found:**

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | Routes for existing `IntegrationOpsService` | Routine | `GET /integrations/health` (per connection + totals), `GET /integrations/failed` (cursor page, filter connection/kind), `POST /integrations/failed/:kind/:id/replay` and `/discard`. Guard `@RequireTenantAdmin()` now | as proposed | Minhaj |
| R2 | Health data source | Routine | Live counts from existing tables (no new table); lag = age of the oldest pending item; 24 h succeeded/failed counts from `jobs`/`outbox_events` | as proposed | Minhaj |
| R3 | Failed list content | Routine | Connection, event type, attempts, last error (redacted), failed-at, blocked-behind count; payload not shown (may hold customer data) | as proposed | Minhaj |
| R4 | Refresh | Routine | Manual refresh button plus 30 s polling while the tab is visible | as proposed | Minhaj |
| Q1 | Who can view health and replay/discard | Business | View and replay: owner/admin now, later a FEAT-003 integrations permission; discard: owner/admin only | as proposed (accepted) | user, 2026-10-14 |
| Q2 | May a dead item be discarded | Business | Yes, with a mandatory reason; the record stays (status discarded), never hard-deleted; discarding an ordering-key head releases the items behind it | as proposed (accepted) | user, 2026-10-14 |
| Q3 | What counts as unhealthy | Business | Healthy: no dead items, lag under 15 min, last test ok. Warning: lag 15-60 min or connection needs_attention. Critical: any dead item or lag over 60 min | as proposed (accepted) | user, 2026-10-14 |
| Q4 | Bulk replay | Business | Per-item replay plus "Replay all failed for this connection" capped at 100 per click, with confirmation | as proposed (accepted) | user, 2026-10-14 |
| Q5 | Drift reconciliation (038.3) policy and timing | Business | Defer 038.3 until FEAT-032 ships (needs a provider, D-02). When built: system stock is the source of truth; detect and report only (variant, channel qty, system qty, difference, checked-at); manual "republish system stock" per variant; channel stock never changes system stock; tolerance 0; on demand plus nightly | as proposed (accepted): 038.3 deferred until FEAT-032 ships; no build or estimate commitment now | user, 2026-10-14 |

**Estimates:** 038.1 5.25 agent h, 038.2 6.75, 038.3 7 = 19 agent h; human verify 6.25 h (see `feature-progress-list.md`).

**Requirements approved:** pending human approval of review and estimates (Q1-Q5 accepted by user 2026-10-14; zero open items for 038.1/038.2; 038.3 deferred - ready for human approval)

## Assignment (Minhaj)

**Execution lane:** Deep

**Why this lane / final verifier:** Replay/discard mutate tenant work state with concurrency (double replay, ordering-key release) and must prove tenant isolation of every new route. Independent QA (Tanvir) with targeted regression of FEAT-031 suites plus the integrations browser flows.

**DRAFT - final once the human approves the review and estimates.**

**User outcome:** Owners/admins can see integration health per connection and replay or discard failed events.

**Accepted policy:** view and replay owner/admin now (FEAT-003 integrations permission later), discard owner/admin only with mandatory reason, record kept as status `discarded`, discarding an ordering-key head releases items behind it; Healthy = no dead items, lag under 15 min, last test ok; Warning = lag 15-60 min or needs_attention; Critical = any dead item or lag over 60 min; per-item replay plus "Replay all failed for this connection" capped at 100 per click with confirmation.
**In scope (038.1, 038.2):** routes R1, health from live counts, failed list (redacted error, blocked-behind count, no payload), 30 s polling, confirmation dialogs, loading/empty/error/forbidden states, `ui-registry.md` entries.
**Deferred (038.3):** stock drift reconciliation waits until FEAT-032 ships (needs a provider, D-02); not assigned now. Design when built: system stock is source of truth, report only, tolerance 0, on-demand plus nightly.
**Layers:** Rabbi (routes, tests), Shamim (`/integrations` UI), then Tanvir. **Lane:** Deep.
**Acceptance criteria (draft):** foreign-tenant ids return 404; second concurrent replay gets 409 with no double run; replay of non-dead item 409; discard needs reason (max 500) and non-admins are refused; bulk replay stops at 100; statuses match thresholds; replay on disabled connection tells the user it waits.
**QA focus:** tenant isolation of every route, concurrency, ordering-key release, FEAT-031 regression.
