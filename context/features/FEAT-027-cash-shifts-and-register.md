# FEAT-027: Cash shifts and register

Status: Frontend - Shamim next (027.1 and 027.2 backend Done by Rabbi 2026-10-14; FE not assigned yet; 027.3-027.5 not started)

## Requirement review (Minhaj)

**Sub-features:** FEAT-027.1 Register setup; FEAT-027.2 Open shift with float; FEAT-027.3 Cash in / cash out; FEAT-027.4 Close shift and reconciliation; FEAT-027.5 Shift report (X/Z).

**Dependencies done:** FEAT-001.4 Locations - Done (FEAT-001 closed). FEAT-002.5 Device / register sign-in - Done (FEAT-002 closed; `RegisterDevice`, `PosGrant`, 12-hour absolute POS session). FEAT-003 (permissions) is not a listed dependency but is needed for `cash.*` permissions; BE and FE are Done and QA is in progress (see FEAT-003 file), so permission additions must be coordinated with that branch. FEAT-004 (audit log, not built) is needed by FEAT-027.3 "audited" - see gap G4.

**Sources checked:** `context/feature-list.md` (FEAT-027, D-xx table: none block it), `context/workflow.md` (store sale flow: open shift ... close/reconcile shift), `context/architecture.md` (shift in data model, tenant/location scope, audit), `context/code-standards.md` (exact decimals or integer minor units, no floats), `context/progress-tracker.md` (2026-10-12 POS access decision: named staff, store-bound browser, 12h absolute session, cash shifts in FEAT-027, no shared account/PIN/offline auth), `context/ui-registry.md` (POS/shifts planned; `/register` exists), `context/project-overview.md`, `context/roadmap.md`, `context/build-plan.md`; `packages/db/prisma/schema.prisma` (Tenant.currencyCode default BDT, businessTimezone default Asia/Dhaka, Location.timezone override, RegisterDevice/PosGrant); `packages/shared/src/authorization.ts` (no cash/shift permissions exist yet; `sales.create` for cashier); research: product spec section "Cash Register" (open shift, opening cash, cash in/out, close, expected vs actual, variance, X/Z report), compass artifact (MVP: opening float, cash in/out, day-end Z-report, cash variance; alert on cash variance), deep-research-report (cash shift in POS). Research is discovery material only.

**Gap checklist:**
- [x] User roles and permissions - G1, B2
- [x] Business rules and policies - B1, B3, B4, B5, B6
- [x] Data fields, validation, uniqueness - G2, G3, G5
- [x] States and transitions - G6
- [x] Failure, edge and concurrency cases - G7, G8, B6
- [x] Tenant and location scope - G9
- [x] Money / tax / timezone rules - G2, G10
- [x] Audit needs - G4
- [x] UI screens and flows - G11
- [x] Integrations - G12 (FEAT-025/026 sales and tenders not built; FEAT-028 receipts/printers and cash drawer out of scope; FEAT-030 offline out of scope)
- [x] Open decisions (D-xx) - none of D-01..D-09 blocks FEAT-027; the business questions below are new feature-level policies

**Gaps found:**

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| G1 | New permissions needed: no shift/cash permission exists | Routine | Add `register.manage` (setup, owner/admin/store manager), `shift.operate` (open/close own shift, cash in/out: cashier, store manager, owner, admin), `shift.read` (reports: store manager, accountant, owner, admin), `shift.override` (close another user's shift / approve large variance: store manager, owner, admin). Final role mapping depends on B2. Added to the shared matrix with FEAT-003 owner coordination | as proposed | Minhaj, 2026-10-14 |
| G2 | Money representation | Routine | Integer minor units (paisa) in DB and API, per-tender amounts as `BigInt`/integer; currency fixed to tenant `currencyCode` (BDT); no floats; cash rounding is off (`cashRounding: false` in shared tenancy) so counted cash may be any whole paisa amount | as proposed | Minhaj, 2026-10-14 |
| G3 | Fields and validation | Routine | Register: tenantId, locationId (store type only, active), name (1-100, unique per location, case-insensitive), optional linked RegisterDevice, active flag. Shift: registerId, openedBy, openedAt, openingFloat >= 0, closedBy, closedAt, status, counted amounts per tender, notes (max 500), version. Cash in/out: shiftId, direction, amount > 0, reason code + optional note (max 250), actor, timestamp. Idempotency key on every mutating call | as proposed | Minhaj, 2026-10-14 |
| G4 | "Audited" cash in/out, but FEAT-004 audit log is not built | Routine | Record each shift event (open, cash in/out, close, override) as append-only rows in shift tables carrying actor, time and before/after values now; FEAT-004 will later consume/mirror them. Do not wait for FEAT-004 | as proposed | Minhaj, 2026-10-14 |
| G5 | Tenders in a shift | Routine | Reconcile per tender type: cash gets expected vs counted; non-cash tenders (card, mobile wallet) are listed with expected totals from sales only and have no counted entry unless B5 says otherwise. Until FEAT-025/026 exist, expected cash = opening float + cash in - cash out; sales/refund cash lines are added later through a stable "shift cash movement" interface | as proposed | Minhaj, 2026-10-14 |
| G6 | State machine | Routine | Shift: `open` -> `closed` (terminal). Register has at most one `open` shift at a time (partial unique index on registerId where status = open). Closed shifts are immutable; corrections are made by an audited override note, not edits | as proposed | Minhaj, 2026-10-14 |
| G7 | Concurrency | Routine | Open/close are transactional with a version check; two concurrent opens on one register -> one wins, other gets 409 `SHIFT_ALREADY_OPEN`; closing twice is idempotent by key; cash in/out against a closed shift -> 409 | as proposed | Minhaj, 2026-10-14 |
| G8 | POS session expiry (12h absolute) vs long shift | Business | See B6 | as proposed | Minhaj, 2026-10-14 |
| G9 | Tenant and location scope | Routine | Every row carries tenantId; composite FK to Location like `RegisterDevice`; register must belong to a store location; actor must be allowed that location (FEAT-003.3 scoping); cashier can act only on a register bound to their approved browser/store | as proposed | Minhaj, 2026-10-14 |
| G10 | Timezone and business date | Routine | Store instants as UTC timestamptz; business date derived in the location timezone (fallback tenant `businessTimezone`) at open time and stored on the shift; Z-report groups by that business date | as proposed | Minhaj, 2026-10-14 |
| G11 | UI | Routine | Planned screens in `ui-registry.md`: register admin list/form (manager), open-shift dialog (float), shift dashboard with cash in/out and X report, close-shift count form with per-tender counted amounts and variance preview, Z-report view/printable page. Follow `ui-rules.md`; no cash drawer hardware control now | as proposed | Minhaj, 2026-10-14 |
| G12 | Receipts, drawer kick, printing, offline | Routine | Out of scope (FEAT-028 / D-09, FEAT-030 / D-03). Reports render in the browser with a print stylesheet only | as proposed | Minhaj, 2026-10-14 |
| B1 | Is a shift per register (one cashier at a time) or can several staff share an open shift on a register? | Business | One open shift per register, owned by the opening user; handover = close and re-open | as proposed (accepted) | user, 2026-10-14 |
| B2 | Who may open/close a shift, cash in/out and see reports; may a cashier see the expected cash total during close (blind count) or must they count first without seeing it? | Business | Cashier opens/closes only own shift and counts blind (expected hidden until submitted); store manager/owner/admin can see all and close any; accountant read-only reports | as proposed (accepted) | user, 2026-10-14 |
| B3 | Variance policy: tolerance amount, required reason, and whether a manager must approve closing with variance above a threshold | Business | Always require a note when variance != 0; variance above a tenant-set threshold (default 0 = any variance) needs manager approval/override; shift still closes and variance is recorded | as proposed (accepted) | user, 2026-10-14 |
| B4 | Cash in/out reason list: fixed reasons or free text | Business | Fixed codes (bank deposit, petty expense, supplier payment, change top-up, other) plus optional note; "other" requires a note | as proposed (accepted) | user, 2026-10-14 |
| B5 | Do card/mobile-wallet tenders need to be counted/reconciled at close (e.g. card terminal slip total), or only cash? | Business | Cash counted only; card/wallet shown as expected totals; optional "declared total" entry deferred | as proposed (accepted) | user, 2026-10-14 |
| B6 | Cashier session ends at 12h absolute but a shift may run longer, or be forgotten open overnight: what happens? | Business | Shift survives session expiry; re-login resumes it. A shift still open after N hours (propose 16) is flagged to manager and can be force-closed by a manager with a recorded counted amount; no auto-close of money | as proposed (accepted) | user, 2026-10-14 |
| B7 | Opening float: must it equal the previous closing cash (carry-over) or be freely entered; is there a maximum float? | Business | Freely entered; show previous closed count as hint and flag difference; no maximum | as proposed (accepted) | user, 2026-10-14 |
| B8 | X vs Z semantics: X = interim read, any time, no state change; Z = final report generated at close and immutable. Does the business also want a day-level Z across all registers of a store? | Business | Per-shift X (open) and Z (closed); store-day summary is a read-only aggregate in FEAT-027.5, not a separate closing step | as proposed (accepted) | user, 2026-10-14 |
| B9 | Must a shift be open before any sale is allowed (enforced in FEAT-025)? | Business | Yes - POS sale requires an open shift on the register (workflow.md: open shift first); FEAT-025 will enforce it | as proposed (accepted) | user, 2026-10-14 |

**Estimates:** replaced baselines in `feature-progress-list.md` (hours, agent-human-review): PM 1.0/0.5 (027.1 carries the review), 0.5/0.25 for 027.2-.5; BE 2.5/0.75, 4/1.25, 3/1, 5/1.5, 3/1; FE 2/0.75, 3/1, 2.5/0.75, 3.5/1, 3/0.75; QA 1.5/0.5, 2.5/0.75, 2/0.5, 3/1, 2/0.5. Close/reconciliation and open-shift concurrency carry the most risk (money, one-open-shift invariant, migration).

**Requirements approved:** yes (human: user, 2026-10-14)

## Assignment (Minhaj)

**Execution lane:** Deep

**Why this lane / final verifier:** Money handling, new migration (registers, shifts, cash movements), concurrency invariant (one open shift per register), tenant/location isolation and audit-like immutability. Rabbi + Shamim, then independent Tanvir pass with full regression after freeze. Delivery mode is now fully-agentic (2026-10-14): no human review gate.

**FINAL - approved by the human 2026-10-14.**

**First build order:** FEAT-027 is built first. Sub-feature order 027.1 Register setup -> 027.2 Open shift -> 027.3 Cash in/out -> 027.4 Close and reconciliation -> 027.5 X/Z report. **This pass: Rabbi builds 027.1 and 027.2 only**, then hands off (BE Done in fully-agentic mode). 027.3-027.5 stay Todo until the 027.1/027.2 FE and QA pass; Shamim builds the 027.1/027.2 FE next (not yet assigned).

**User outcome:** Cashiers open a shift with a float on a store register, record cash in/out, close with a counted amount and see variance; managers see X/Z reports.

**Accepted policy (B1-B9):** one open shift per register owned by the opening user (handover = close and re-open); cashier opens/closes only own shift and counts blind; manager/owner/admin see all and close any; accountant read-only reports; note required when variance is not 0, variance above a tenant threshold (default 0) needs manager override, shift still closes; fixed cash in/out reason codes (bank deposit, petty expense, supplier payment, change top-up, other; other requires note); cash counted only, card/wallet shown as expected totals; shift survives POS session expiry, flagged to manager after 16 h and force-closable by a manager with a recorded count, no auto-close; opening float freely entered with previous closing count as hint and no maximum; X = interim read, Z = immutable at close, store-day summary is read-only aggregate; POS sale requires an open shift (enforced in FEAT-025).
**In scope:** 027.1-027.5 with routine gap answers G1-G12.
**Out of scope:** receipts/drawer hardware (FEAT-028), offline (FEAT-030), sale/refund cash lines (FEAT-025/026 plug in later), declared card totals.
**Layers:** Rabbi (this pass: 027.1, 027.2), then Shamim, then Tanvir. **Lane:** Deep.
**Acceptance criteria:** concurrent opens give one success and 409 `SHIFT_ALREADY_OPEN`; expected cash = float + cash in - cash out; close with variance needs note; closed shift immutable and cash in/out against it 409; cashier cannot see expected before submitting count; business date in location timezone; tenant/location isolation; idempotency keys on mutations.
**QA focus:** one-open-shift race, money exactness, blind count, immutability, permission matrix, full regression after freeze.

### Rabbi - backend tasks for this pass (027.1 + 027.2), in order

FEAT-003 is merged to master and contained in this branch: reuse its permission guard, `ROLE_PERMISSIONS` matrix and location scoping (`apps/api/src/database/tenant-scope.ts`, FEAT-003.3 location-scope checks). Do not invent new mechanisms. Follow `RegisterDevice` for composite tenant/location FKs.

1. **Permissions (`packages/shared/src/authorization.ts`).** `register.manage` already exists (owner, admin, store_manager) - reuse it. Add `shift.operate`, `shift.read`, `shift.override` to `PERMISSIONS` and `ROLE_PERMISSIONS`: `shift.operate` = cashier, store_manager, owner, admin; `shift.read` = store_manager, accountant, owner, admin; `shift.override` = store_manager, owner, admin. Update FEAT-003 matrix tests/docs that enumerate permissions.
2. **Migration (`packages/db`, Neon test branch only; never main).** New tables: `Register` (tenantId, locationId composite FK, name, active, optional registerDeviceId, unique (locationId, lower(name))); `Shift` (tenantId, registerId, openedByUserId, openedAt timestamptz, businessDate date, openingFloatPaisa BigInt >= 0, status open|closed, closedByUserId, closedAt, countedCashPaisa, notes, version, idempotency key unique per tenant); `ShiftCashMovement` (shiftId, direction, amountPaisa > 0, reasonCode, note) and `ShiftEvent` (append-only: shiftId, type open|cash_in|cash_out|close|override, actor, at, before/after JSON). Create the movement/event tables now so 027.3-027.5 migrations stay additive. **Partial unique index: one `open` shift per register** (`UNIQUE (registerId) WHERE status = 'open'`, raw SQL in the migration). CHECK constraints for non-negative paisa. Every row carries tenantId.
3. **Money and time.** Integer paisa (BigInt in DB, integer in API; never floats; currency fixed to tenant `currencyCode`). `businessDate` computed at open time in the location timezone, falling back to tenant `businessTimezone`; instants stored UTC.
4. **027.1 Register setup.** Nest module `registers`: create/list/get/update/deactivate. Location must be an active `store` type the actor may access; name 1-100 unique per location case-insensitive; optional link to existing `RegisterDevice`. Requires `register.manage` (list/get also `register.use` or `shift.read`). Deactivation refused while a shift is open (409).
5. **027.2 Open shift.** `shifts` module: open (float >= 0, optional note), get current shift for a register, list. Transactional; the partial unique index is the arbiter, mapping the violation to 409 `SHIFT_ALREADY_OPEN`. Opener = authenticated user; requires `shift.operate` and, for cashiers, a register on their approved store/browser (PosGrant/RegisterDevice scope). Return the previous closed shift count as `previousClosingCountPaisa` plus `floatDiffersFromPrevious`. Idempotency key on open (replay returns the same shift). Append a `ShiftEvent` `open` row in the same transaction. Inactive register -> 409.
6. **Shared DTOs** in `packages/shared` for the contract below (`ui-registry.md` entries are Shamim's job).
7. **Tests.** Vitest unit tests (validation, money, business-date/timezone incl. date rollover, permission matrix for the 3 new permissions x 8 roles, idempotency) and integration tests against the Neon **test** branch only (use the existing DB target guard): concurrent opens (Promise.all) -> exactly one 201, rest 409 `SHIFT_ALREADY_OPEN`; cross-tenant register/shift ids 404; cross-location actor denied; cashier cannot open another store's register; float 0 allowed, negative/fractional rejected; open event row written; deactivate with open shift 409; migration applies on a clean branch. Run scoped lint/typecheck/tests only (not the full repo or browser suite).

### API contract Rabbi must deliver for Shamim (tenant-scoped API prefix used by existing modules; shared error envelope)

- `POST /registers` {locationId, name, registerDeviceId?} -> 201 Register; `GET /registers?locationId=&active=` (cursor paginated); `GET /registers/:id`; `PATCH /registers/:id` {name?, registerDeviceId?, active?} (version-checked)
- `POST /registers/:id/shifts` header `Idempotency-Key`, body {openingFloatPaisa: integer >= 0, note?} -> 201 Shift {id, registerId, status, openedBy, openedAt, businessDate, openingFloatPaisa, version, previousClosingCountPaisa|null, floatDiffersFromPrevious}; 409 `SHIFT_ALREADY_OPEN`
- `GET /registers/:id/shifts/current` -> Shift or 404 `NO_OPEN_SHIFT`; `GET /shifts?registerId=&status=&businessDate=` (cursor paginated)
- Money fields are named `...Paisa` (integer). Expected-cash fields are omitted for cashiers while the shift is open (blind count). Error codes: `SHIFT_ALREADY_OPEN`, `NO_OPEN_SHIFT`, `REGISTER_INACTIVE`, `REGISTER_NAME_TAKEN`, `FORBIDDEN`, validation error envelope.
- Record the final contract in the Backend handoff section of this file.

**Handoff:** when 027.1/027.2 pass targeted checks, set BE to `Done` for both sub-features (fully-agentic mode) and fill the Backend handoff (outcome, contract changes, validation, unresolved risks). Do not start 027.3-027.5.

## Backend handoff (Rabbi)

**Scope done:** 027.1 Register setup and 027.2 Open shift (commits 3c732cb, c899c33). 027.3-027.5 not started. Effort roughly in line with the 2.5 h / 4 h BE agent estimates (the interrupted first run already had schema/migration/DTOs).

**Migrations (applied to the Neon test branch only via `db:migrate:deploy:test`; `db:drift` against test = no difference):**
- `20261014090000_cash_registers_shifts`: tables `registers`, `shifts`, `shift_cash_movements`, `shift_events` (tenant_id on every row, composite FKs to locations/registers/shifts, shift location is forced equal to its register's location). Money is BigInt paisa with CHECK >= 0 (movements > 0); state CHECK (open has no closing data, closed has closer/time/count); register name CHECK (trimmed, 1-100, `name_key` = lower name) and unique (tenant, location, name_key); **partial unique index `shifts_one_open_per_register_idx` (register_id WHERE status = 'open')**; triggers: closed shifts immutable, movements/events append-only (no UPDATE).
- `20261014100000_cash_paisa_upper_bound` (additive follow-up, first migration left unchanged because it was already applied to test): paisa <= 9007199254740991 (Number.MAX_SAFE_INTEGER). Manual rollback comments are in both files.
- Permissions: `shift.operate` (owner, admin, store_manager, cashier), `shift.read` (owner, admin, store_manager, accountant), `shift.override` (owner, admin, store_manager) added to `ROLE_PERMISSIONS`; `register.manage` reused. `Register/Shift/ShiftCashMovement/ShiftEvent` registered in `tenant-scope.ts`.

**API contract (shared types in `packages/shared/src/cash.ts`: `RegisterDto`, `CreateRegisterRequest`, `UpdateRegisterRequest`, `ShiftDto`, `OpenShiftRequest`, `CashErrorCode`, `CASH_LIMITS`, `IDEMPOTENCY_KEY_HEADER`; same prefix and error envelope as other modules):**
- `POST /registers` {locationId, name, registerDeviceId?} -> 201 RegisterDto. `register.manage`. Location must be an active `store` of the tenant (404 unknown/other tenant, 422 not an active store); device must be same-store and not revoked (422); 409 `REGISTER_NAME_TAKEN` (per location, case-insensitive).
- `GET /registers?locationId=&active=&limit=&cursor=` -> {items, nextCursor} (sorted by name, id). `GET /registers/:id`. Reads need `register.manage` or `register.use` or `shift.read`.
- `PATCH /registers/:id` {version (required), name?, registerDeviceId?, active?} -> RegisterDto, version +1; 409 `VERSION_CONFLICT`; deactivating (`active:false`) with an open shift -> 409 `REGISTER_HAS_OPEN_SHIFT`; reactivation needs the store active again (422). No DELETE.
- `POST /registers/:id/shifts` header `Idempotency-Key` (required, 8-128 chars `[A-Za-z0-9._:-]`), body {openingFloatPaisa: whole number 0..9007199254740991, note?: <=500} -> **201** ShiftDto, or **200** with the same body when the key is replayed by the same user with the same request. ShiftDto = {id, registerId, locationId, status, openedBy, openedAt, businessDate (YYYY-MM-DD in location tz else tenant tz), openingFloatPaisa, note, version, previousClosingCountPaisa|null, floatDiffersFromPrevious, closedBy, closedAt}. Needs `shift.operate`. Errors: 409 `SHIFT_ALREADY_OPEN`, 409 `REGISTER_INACTIVE` (register or its store inactive), 409 `IDEMPOTENCY_KEY_REUSED` (key used for a different register/float/note/user), 403 `LOCATION_ACCESS_REQUIRED`, 403 `REGISTER_DEVICE_MISMATCH` (cashier only), 403 `REGISTER_APPROVAL_REQUIRED` / 401 `POS_SESSION_EXPIRED` (cashier without an approved browser / live POS grant), 404 unknown or other-tenant register, 400 validation.
- `GET /registers/:id/shifts/current` -> ShiftDto or 404 `NO_OPEN_SHIFT` (`shift.operate` or `shift.read`). `GET /shifts?registerId=&status=&businessDate=&limit=&cursor=` newest first; users without `shift.read` (cashiers) see only shifts they opened.
- Expected-cash fields do not exist yet (027.4); the blind-count rule is applied when close/reports are built.

**Behaviour notes:** cashiers (role `cashier`) may open only on a register at the store of their approved browser with a live POS grant, and only on the linked browser if the register has one; manager/owner/admin are not browser-bound. Location-scoped members get 403 outside their locations. Open takes `FOR SHARE` on the register row, deactivation `FOR UPDATE`, so open vs deactivate can never leave an inactive register with an open shift; concurrent opens are decided by the partial unique index. Each open writes the shift and a `ShiftEvent` (type `open`, actor, before/after JSON with integer paisa) in one transaction.

**Validation (all green):**
- `pnpm --filter api test:unit`: 31 files, 446 tests pass (new: register.dto 4, shift.dto 9, shift.service 16 incl. date rollover/timezone override/idempotency/race mapping/cashier scope, authorization matrix 3 new).
- `pnpm --filter api test:integration src/shifts src/registers` (Neon test branch): 2 files, 36 tests pass (registers CRUD/isolation/versioning/deactivate guard/name race; real Better Auth sessions: role matrix, cross-tenant 404, cross-location 403, cashier browser scope, expired POS grant, concurrent opens x3 rounds = exactly one 201 and 7x 409, same-key race, open-vs-deactivate race x4, float 0/negative/fractional/max, previous closing count, location-timezone business date, list/cursor filters, DB constraints/triggers). `src/tenancy` int specs also re-run green after the shared changes (registers+tenancy: 34 tests).
- `pnpm --filter api lint`, `typecheck`, `build`; `@ims/db` lint/typecheck/build/test (16); `@ims/shared` lint/typecheck; prettier check clean.

**Unresolved risks / limitations:**
1. "Migration applies on a clean branch" was not run on a fresh Neon branch (no branch created); migrations were applied incrementally to the existing test branch and `db:drift` shows no difference. Tanvir should confirm on a clean branch before main.
2. Not applied to dev or main branches (by instruction).
3. Business-date rollover at the HTTP level is covered with mocked clocks (unit) plus a real-DB timezone-override test; the real database test cannot freeze time.
4. Owner/admin paths are not exercised with real sessions in the new int spec (they need MFA); the guard logic is unchanged and they are covered by the permission matrix and the dev-header registers spec.
5. A cashier's list of shifts is limited to their own (my reading of B2); `current` still returns the register's open shift to any `shift.operate` user so a cashier can see why an open is refused. Flag if Minhaj wants otherwise.
6. Several registers may link the same browser (no uniqueness rule was specified).

## Frontend handoff (Shamim)

## QA report (Tanvir)

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
