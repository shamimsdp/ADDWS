# FEAT-027: Cash shifts and register

Status: Requirements - Minhaj (all business answers accepted 2026-10-14; pending human approval of review and estimates)

## Requirement review (Minhaj)

**Sub-features:** FEAT-027.1 Register setup; FEAT-027.2 Open shift with float; FEAT-027.3 Cash in / cash out; FEAT-027.4 Close shift and reconciliation; FEAT-027.5 Shift report (X/Z).

**Dependencies done:** FEAT-001.4 Locations - Done (FEAT-001 closed). FEAT-002.5 Device / register sign-in - Done (FEAT-002 closed; `RegisterDevice`, `PosGrant`, 12-hour absolute POS session). FEAT-003 (permissions) is not a listed dependency but is needed for `cash.*` permissions; it is in Review/QA (see FEAT-003 file), so permission additions must be coordinated with that branch. FEAT-004 (audit log, not built) is needed by FEAT-027.3 "audited" - see gap G4.

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

**Requirements approved:** pending human approval of review and estimates (all B1-B9 accepted by user 2026-10-14; zero open items - ready for human approval)

## Assignment (Minhaj)

**Execution lane:** Deep (proposed)

**Why this lane / final verifier:** Money handling, new migration (registers, shifts, cash movements), concurrency invariant (one open shift per register), tenant/location isolation and audit-like immutability. Rabbi + Shamim, then independent Tanvir pass with full regression after freeze. Human verifies each layer (agent-human-review).

**DRAFT - final once the human approves the review and estimates.**

**User outcome:** Cashiers open a shift with a float on a store register, record cash in/out, close with a counted amount and see variance; managers see X/Z reports.

**Accepted policy (B1-B9):** one open shift per register owned by the opening user (handover = close and re-open); cashier opens/closes only own shift and counts blind; manager/owner/admin see all and close any; accountant read-only reports; note required when variance is not 0, variance above a tenant threshold (default 0) needs manager override, shift still closes; fixed cash in/out reason codes (bank deposit, petty expense, supplier payment, change top-up, other; other requires note); cash counted only, card/wallet shown as expected totals; shift survives POS session expiry, flagged to manager after 16 h and force-closable by a manager with a recorded count, no auto-close; opening float freely entered with previous closing count as hint and no maximum; X = interim read, Z = immutable at close, store-day summary is read-only aggregate; POS sale requires an open shift (enforced in FEAT-025).
**In scope:** 027.1-027.5 with routine gap answers G1-G12 (integer paisa, partial unique index, append-only shift events, new `register.manage`/`shift.*` permissions coordinated with FEAT-003).
**Out of scope:** receipts/drawer hardware (FEAT-028), offline (FEAT-030), sale/refund cash lines (FEAT-025/026 plug in later), declared card totals.
**Layers:** Rabbi, Shamim, then Tanvir. **Lane:** Deep.
**Acceptance criteria (draft):** concurrent opens give one success and 409 `SHIFT_ALREADY_OPEN`; expected cash = float + cash in - cash out; close with variance needs note; closed shift immutable and cash in/out against it 409; cashier cannot see expected before submitting count; business date in location timezone; tenant/location isolation; idempotency keys on mutations.
**QA focus:** one-open-shift race, money exactness, blind count, immutability, permission matrix, full regression after freeze.

## Backend handoff (Rabbi)

## Frontend handoff (Shamim)

## QA report (Tanvir)

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
