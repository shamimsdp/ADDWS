# Feature list

Owner: Minhaj (project manager). Source: `project-overview.md`, `build-plan.md`, `roadmap.md`, `architecture.md`, product spec.
Progress for every item is tracked in `feature-progress-list.md`; the dependency-ranked "what next" view is `feature-queue.md` (run `node scripts/feature-queue.mjs`). Active work and bugs are in `task-board.md`; per-feature requirements and handoffs in `features/`.

## Conventions

- **IDs:** `FEAT-XXX` = feature, `FEAT-XXX.N` = sub-feature. IDs are permanent — never renumber; add new items at the end of their group or with the next free number.
- **Priority:** P0 = required for first release (MVP), P1 = first release if time allows, P2 = post-release.
- **Stage:** matches `roadmap.md` — Setup, Foundation, Retail, Online, Pilot, Growth, Intelligence, Enterprise.
- **Blocked by:** an open business decision (see list at the bottom). Minhaj must not assign a blocked sub-feature until the decision is recorded in `progress-tracker.md`.
- **Layer:** BE = Rabbi (DB + NestJS + Vitest), FE = Shamim (Next.js + Playwright), QA = Tanvir. Minhaj assigns only affected layers using the Fast / Standard / Deep lanes in `workflow.md`; the full BE → FE → QA sequence is reserved for cross-layer Deep work.

---

## Stage 0 — Setup

### FEAT-000 Project setup — P0

Depends on: — · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-000.1 | Monorepo scaffold | pnpm workspaces + Turborepo; `apps/api`, `apps/web`, `packages/db`, `packages/shared`; TS strict, ESLint, Prettier |
| FEAT-000.2 | NestJS API skeleton | Config module, health endpoint, global validation pipe, exception filter, structured logging with correlation IDs. BE-only |
| FEAT-000.3 | Prisma + Neon setup | `packages/db` schema, migration scripts, pooled/direct URLs, `main`/`dev`/`test` Neon branches, seed script. BE-only |
| FEAT-000.4 | Vitest setup | Unit config, test DB branch wiring, coverage. BE-only |
| FEAT-000.5 | Next.js web skeleton | App Router, Tailwind theme from `ui-tokens.md`, base layout, API client using `packages/shared` types. FE-only |
| FEAT-000.6 | Playwright setup | `apps/web/e2e`, config, test-data seeding hooks, `test:e2e` script. FE-only |
| FEAT-000.7 | CI pipeline | lint, build, unit, e2e on every push; migration check |

---

## Stage 1 — Foundation

### FEAT-001 Tenancy and organization — P0

Depends on: FEAT-000 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-001.1 | Tenant model and isolation | Tenant ID on every tenant-owned table; tenant-scoped queries and uniqueness enforced server-side |
| FEAT-001.2 | Legal entity | One legal entity per tenant initially |
| FEAT-001.3 | Brands | Multiple brands per tenant |
| FEAT-001.4 | Locations | Store, warehouse, online fulfilment location types; address, timezone, active flag |
| FEAT-001.5 | Tenant settings | Currency, business timezone, document number formats, rounding policy |

### FEAT-002 Authentication and user management — P0

Depends on: FEAT-001 · Blocked by: — (D-01 decided: Better Auth)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-002.1 | Sign-in / sign-out / sessions | |
| FEAT-002.2 | Password reset and email verification | |
| FEAT-002.3 | User invitation and deactivation | Per tenant |
| FEAT-002.4 | Mandatory MFA for owner/admin | P0; user approved mandatory TOTP/recovery now, 2026-10-12 |
| FEAT-002.5 | Device / register sign-in for POS | Approved store-bound browser, named email/password; 12-hour absolute sessions; cash shifts in FEAT-027 |

### FEAT-003 Roles and permissions — P0

Depends on: FEAT-002 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-003.1 | Predefined roles | Owner/admin, store manager, cashier, warehouse operator, purchaser, online order agent, accountant |
| FEAT-003.2 | Permission guards | NestJS guards per action; UI hides what the user cannot do |
| FEAT-003.3 | Location scoping | User assigned to locations; server rejects out-of-scope access |
| FEAT-003.4 | Cost visibility permission | Cost/margin hidden unless granted |
| FEAT-003.5 | Custom roles | P1 |

### FEAT-004 Audit log — P0

Depends on: FEAT-001, FEAT-003 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-004.1 | Audit event recording | Who, what, when, before/after, correlation ID; append-only |
| FEAT-004.2 | Audit viewer | Filter by user, entity, date, action |

### FEAT-005 Catalog masters — P0

Depends on: FEAT-001, FEAT-003 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-005.1 | Size master and size groups | Ordered size runs (S–XXL, 28–40, kids ages) |
| FEAT-005.2 | Color master | Name, code, swatch |
| FEAT-005.3 | Categories / departments | Hierarchical |
| FEAT-005.4 | Season and collection | Classifications, not hierarchy |
| FEAT-005.5 | Product attributes | Fabric, fit, gender, sleeve, custom attributes |
| FEAT-005.6 | Units of measure | Piece, set, pair, pack |

### FEAT-006 Product catalog and variant matrix — P0

Depends on: FEAT-005 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-006.1 | Style (product master) | Style code, name, brand, category, attributes, status |
| FEAT-006.2 | Colorways | Colors offered per style |
| FEAT-006.3 | Variant matrix and SKU generation | Style × color × size → SKU; configurable SKU pattern; no duplicates |
| FEAT-006.4 | Variant pricing and cost fields | Base price, MRP, cost (cost visibility permission) |
| FEAT-006.5 | Product search and list | Search by style, SKU, barcode, attributes |
| FEAT-006.6 | Activate / archive | Archived variants cannot be sold or received |

### FEAT-007 Barcodes and labels — P0

Depends on: FEAT-006 · Blocked by: D-09 (hardware) for printing

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-007.1 | Barcode generation and assignment | Internal codes; accept supplier/EAN codes; unique per tenant |
| FEAT-007.2 | Barcode lookup | Scan resolves to exact variant |
| FEAT-007.3 | Label templates | Price tag / hang tag layouts, Bangla font support |
| FEAT-007.4 | Label printing | Batch from PO receipt or selection |

### FEAT-008 Product media — P1

Depends on: FEAT-006 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-008.1 | Image upload per style/colorway | Storage provider TBD |
| FEAT-008.2 | Image ordering and primary image | |

### FEAT-009 Data import — P0

Depends on: FEAT-006, FEAT-010, FEAT-011 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-009.1 | Import framework | Upload CSV/XLSX, background job, status |
| FEAT-009.2 | Preview and validation | Row errors before commit; no partial silent imports |
| FEAT-009.3 | Product/variant import | Multi-color/multi-size style without duplicates |
| FEAT-009.4 | Supplier and customer import | |
| FEAT-009.5 | Opening stock import | Feeds FEAT-013 |
| FEAT-009.6 | Import reconciliation report | Imported vs source totals |

### FEAT-010 Supplier master — P0

Depends on: FEAT-001, FEAT-003 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-010.1 | Supplier CRUD | Contact, terms, currency, active flag |
| FEAT-010.2 | Supplier product codes | Map supplier SKU to variant |

### FEAT-011 Customer master — P0

Depends on: FEAT-001, FEAT-003 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-011.1 | Customer CRUD | Phone-first identity, dedupe by phone |
| FEAT-011.2 | Quick add at POS | |
| FEAT-011.3 | Purchase history | Sales, returns, exchanges |

---

## Stage 2 — Inventory and procurement

### FEAT-012 Inventory ledger and balances — P0

Depends on: FEAT-006, FEAT-001.4 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-012.1 | Immutable stock movements | Every posted change = movement; corrections append reversals. BE-only |
| FEAT-012.2 | Balance projection | Updated in the same transaction; buckets sellable / quarantine / damaged |
| FEAT-012.3 | Idempotent posting | Idempotency keys; repeated post changes nothing. BE-only |
| FEAT-012.4 | Concurrency control | Last-unit protection under concurrent posts. BE-only |
| FEAT-012.5 | Stock views | By SKU × location; on-hand, available, reserved, inbound, in-transit |
| FEAT-012.6 | Movement history | Per SKU/location with source document links |
| FEAT-012.7 | Ledger rebuild check | Reconstruct balances from movements and compare. BE-only |

### FEAT-013 Opening stock — P0

Depends on: FEAT-012 · Blocked by: D-04 (valuation) for cost

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-013.1 | Opening stock entry | Manual and via import; validated before posting |
| FEAT-013.2 | Opening cost | |

### FEAT-014 Stock adjustments — P0

Depends on: FEAT-012 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-014.1 | Adjustment document | Reason codes (damage, loss, found, correction) |
| FEAT-014.2 | Approval rules | Above threshold requires manager approval |
| FEAT-014.3 | Bucket moves | Sellable ↔ quarantine ↔ damaged |

### FEAT-015 Stock count — P0

Depends on: FEAT-012 · Blocked by: D-07 (count cutoff policy)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-015.1 | Count session | Full or partial (category/zone); cutoff/freeze |
| FEAT-015.2 | Blind count entry | Scanner and manual |
| FEAT-015.3 | Variance and recount | |
| FEAT-015.4 | Approval and adjustment posting | |

### FEAT-016 Transfers — P0

Depends on: FEAT-012 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-016.1 | Transfer request and approval | |
| FEAT-016.2 | Dispatch | Moves stock to in-transit |
| FEAT-016.3 | Partial / full receive | |
| FEAT-016.4 | Discrepancy resolution | Short/over/damaged recorded explicitly |
| FEAT-016.5 | Transfer close | Aggregate quantity preserved except recorded losses |

### FEAT-017 Reservations and availability — P0

Depends on: FEAT-012 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-017.1 | Reservation create / release / consume | Release once on cancel; consume once on dispatch. BE-only |
| FEAT-017.2 | Available-to-sell calculation | Sellable − reserved − safety buffer. BE-only |
| FEAT-017.3 | Safety buffer settings | Per channel / location |

### FEAT-018 Cost layers and aging — P0

Depends on: FEAT-012, FEAT-020 · Blocked by: D-04 (valuation method)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-018.1 | Receipt cost layers | Cost and receipt date per layer. BE-only |
| FEAT-018.2 | Cost of goods on sale | Per valuation method. BE-only |
| FEAT-018.3 | Age provenance through transfers | |
| FEAT-018.4 | Inventory valuation view | Cost-permission only |

### FEAT-019 Purchase orders — P0

Depends on: FEAT-010, FEAT-006 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-019.1 | Draft PO with size matrix entry | Style × color × size grid |
| FEAT-019.2 | Approval | |
| FEAT-019.3 | Send / mark ordered | PDF/print |
| FEAT-019.4 | PO status tracking | Open, partially received, received, closed, cancelled |
| FEAT-019.5 | Landed cost | Freight/duty allocation. P1 |

### FEAT-020 Goods receipt — P0

Depends on: FEAT-019, FEAT-012 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-020.1 | Receive against PO | Partial and full; scanner support |
| FEAT-020.2 | Inspection | Post to sellable / quarantine / damaged |
| FEAT-020.3 | Over/short handling | Explicit discrepancy |
| FEAT-020.4 | Label print on receipt | Uses FEAT-007.4 |

### FEAT-021 Supplier returns — P1

Depends on: FEAT-020 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-021.1 | Return to supplier document | From damaged/quarantine |
| FEAT-021.2 | Supplier credit tracking | |

---

## Stage 3 — Store retail

### FEAT-022 Pricing and price lists — P0

Depends on: FEAT-006 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-022.1 | Base price per variant | |
| FEAT-022.2 | Location price lists | P1 |
| FEAT-022.3 | Price history | |

### FEAT-023 Basic discounts — P0

Depends on: FEAT-022 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-023.1 | Line and cart discount | % or amount; cashier limit by role |
| FEAT-023.2 | Simple promotions | Date-bound % off category/style; no unrestricted stacking |
| FEAT-023.3 | Manager override | Audited |

### FEAT-024 Tax calculation — P0

Depends on: FEAT-005 · Blocked by: D-05 (tax applicability)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-024.1 | Tax rules by tax class | Centralized calculation and rounding. BE-only |
| FEAT-024.2 | Tax-inclusive / exclusive pricing | |
| FEAT-024.3 | Tax on receipts and reports | |
| FEAT-024.4 | Tax classes | Assign tax class to category/style; values per D-05 |

### FEAT-025 POS checkout — P0

Depends on: FEAT-007.2, FEAT-012, FEAT-022, FEAT-023, FEAT-024, FEAT-027 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-025.1 | Cart via scan / search | Exact variant from barcode |
| FEAT-025.2 | Customer attach | Uses FEAT-011.2 |
| FEAT-025.3 | Sale posting | Stock movement + price/tax/discount snapshots, idempotent |
| FEAT-025.4 | Hold / recall sale | P1 |
| FEAT-025.5 | Void before completion | Audited |

### FEAT-026 Payments and split tender — P0

Depends on: FEAT-025 · Blocked by: D-08 (payment provider scope)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-026.1 | Cash with change | |
| FEAT-026.2 | Card / mobile wallet records | Manual reference initially |
| FEAT-026.3 | Split tender | |
| FEAT-026.4 | Integrated payment provider | P1, pending D-08 |

### FEAT-027 Cash shifts and register — P0

Depends on: FEAT-001.4, FEAT-002.5 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-027.1 | Register setup | Registers per store |
| FEAT-027.2 | Open shift with float | |
| FEAT-027.3 | Cash in / cash out | Reasons, audited |
| FEAT-027.4 | Close shift and reconciliation | Expected vs counted per tender |
| FEAT-027.5 | Shift report (X/Z) | |

### FEAT-028 Receipts and printing — P0

Depends on: FEAT-025 · Blocked by: D-09 (hardware)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-028.1 | Receipt template | Bangla/English, tax lines, return policy text |
| FEAT-028.2 | Thermal print | |
| FEAT-028.3 | Reprint and SMS/digital receipt | Digital P1 |

### FEAT-029 Returns and exchanges — P0

Depends on: FEAT-025, FEAT-026 · Blocked by: D-06 (return policy)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-029.1 | Find original sale | By receipt number, phone, barcode |
| FEAT-029.2 | Eligibility check | Policy window; cannot exceed returnable quantity |
| FEAT-029.3 | Return with inspection | Posts to sellable or damaged |
| FEAT-029.4 | Refund | Original tender or store credit |
| FEAT-029.5 | Exchange | Linked replacement sale; settle difference |

### FEAT-030 Offline POS — P0

Depends on: FEAT-025, FEAT-026, FEAT-027 · Blocked by: D-03 (offline stock policy)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-030.1 | Local catalog/price cache | |
| FEAT-030.2 | Offline sale queue | Durable local storage |
| FEAT-030.3 | Sync on reconnect | Each queued sale posts exactly once |
| FEAT-030.4 | Conflict handling | Per agreed policy (e.g. negative stock exception) |

---

## Stage 4 — Automated online operations

### FEAT-031 Integration framework — P0

Depends on: FEAT-000, FEAT-001 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-031.1 | Transactional outbox | BE-only |
| FEAT-031.2 | Background worker and job queue | BE-only |
| FEAT-031.3 | Connector abstraction | Versioned provider payloads. BE-only |
| FEAT-031.4 | Inbound webhooks | Signature verification, dedupe, out-of-order handling. BE-only |
| FEAT-031.5 | Retry with backoff and dead-letter | BE-only |
| FEAT-031.6 | Connection settings UI | Credentials stored encrypted, never shown |

### FEAT-032 Ecommerce catalog mapping and stock publication — P0

Depends on: FEAT-031, FEAT-006, FEAT-017 · Blocked by: D-02 (ecommerce provider)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-032.1 | External product/variant mapping | Auto-match by SKU/barcode + manual mapping |
| FEAT-032.2 | Unmapped items queue | |
| FEAT-032.3 | Available stock publication | Store sale updates online availability |
| FEAT-032.4 | Catalog authority rules | Which system owns titles/prices |

### FEAT-033 Online order intake — P0

Depends on: FEAT-032, FEAT-017 · Blocked by: D-02

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-033.1 | Automated order import | Webhook + polling fallback |
| FEAT-033.2 | Mapping validation | Exceptions for unmapped lines |
| FEAT-033.3 | Reservation on import | Affects POS available stock |
| FEAT-033.4 | Order list and detail | Separate order, payment, shipment statuses |
| FEAT-033.5 | Cancellation | Releases reservation exactly once |
| FEAT-033.6 | Fulfilment location routing | Rule-based. P1 |

### FEAT-034 Fulfilment — P0

Depends on: FEAT-033 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-034.1 | Pick list | |
| FEAT-034.2 | Pack with scan verification | |
| FEAT-034.3 | Dispatch | Consumes reservation exactly once |

### FEAT-035 Courier booking and tracking — P0

Depends on: FEAT-034, FEAT-031 · Blocked by: D-02b (courier provider)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-035.1 | Courier booking | |
| FEAT-035.2 | Shipping labels | |
| FEAT-035.3 | Tracking status sync | |
| FEAT-035.4 | Delivery / failed delivery handling | |

### FEAT-036 COD settlement reconciliation — P0

Depends on: FEAT-035 · Blocked by: D-08b (COD matching rules)

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-036.1 | Settlement import | From courier |
| FEAT-036.2 | Match settlements to orders | Delivered COD stays outstanding until matched |
| FEAT-036.3 | Exception queue | Short/over/unmatched |
| FEAT-036.4 | COD outstanding report | |

### FEAT-037 Online returns — P0

Depends on: FEAT-035, FEAT-029.3 · Blocked by: D-06

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-037.1 | Courier return (RTO) tracking | |
| FEAT-037.2 | Return receipt and inspection | Restock only after inspection |
| FEAT-037.3 | Online refund / exchange record | |

### FEAT-038 Integration health and recovery — P0

Depends on: FEAT-031 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-038.1 | Integration health dashboard | Lag, failures, last sync |
| FEAT-038.2 | Failed event list and replay | |
| FEAT-038.3 | Stock drift reconciliation | Compare channel stock vs system. Deferred by user decision (2026-10-14) until FEAT-032 ships; do not assign before then |

---

## Stage 5 — Pilot readiness

### FEAT-039 Reports — P0

Depends on: FEAT-012, FEAT-025, FEAT-033 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-039.1 | Sales report | By day, location, channel, style, size, color |
| FEAT-039.2 | Stock on hand report | |
| FEAT-039.3 | Stock movement history report | |
| FEAT-039.4 | Inventory aging | |
| FEAT-039.5 | Sell-through and size performance | |
| FEAT-039.6 | End-of-day cash and COD totals | |
| FEAT-039.7 | Dashboard home | Key metrics |

### FEAT-040 Low stock rules and alerts — P0

Depends on: FEAT-012 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-040.1 | Min/max rules per SKU/location | |
| FEAT-040.2 | Low stock list | |
| FEAT-040.3 | In-app notifications | |

### FEAT-041 Exports — P0

Depends on: FEAT-039 · Blocked by: D-05 for tax exports

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-041.1 | CSV/XLSX export of lists and reports | |
| FEAT-041.2 | Accounting / tax exports | Pending D-05 |

### FEAT-042 Localization — P0

Depends on: FEAT-000.5 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-042.1 | Bangla / English UI | FE-only |
| FEAT-042.2 | BDT currency and number formatting | |
| FEAT-042.3 | Business timezone and dates | |

### FEAT-043 Tenant onboarding — P0

Depends on: FEAT-001, FEAT-003, FEAT-009 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-043.1 | Signup and tenant creation | |
| FEAT-043.2 | Setup wizard | Legal/tax settings → locations → roles → import → opening stock → go live |
| FEAT-043.3 | Go-live checklist | Hardware, barcode, reconciliation checks |

### FEAT-044 SaaS administration — P0

Depends on: FEAT-001, FEAT-003 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-044.1 | Platform admin console | Tenant list, status, suspend |
| FEAT-044.2 | Plans and limits | Locations, users, connectors |
| FEAT-044.3 | Support access | Time-limited, audited impersonation |

### FEAT-045 Backup and operational recovery — P0

Depends on: FEAT-000.3 · Blocked by: —

| ID | Sub-feature | Notes |
|---|---|---|---|
| FEAT-045.1 | Backup / restore procedure | Neon branching/PITR; verified restore drill. BE-only |
| FEAT-045.2 | Monitoring and alerting | Errors, job failures, sync lag. BE-only |
| FEAT-045.3 | Runbooks | Rollback and incident steps |

---

## Stage 6 — Developer tooling

### FEAT-046 Local agent dashboard — P1

Depends on: FEAT-000 · Blocked by: —

Explicitly requested by the user; local developer tooling outside customer MVP scope.

| ID | Sub-feature | Notes |
|---|---|---|
| FEAT-046.1 | Activity telemetry and local server | Node-only loopback server, shared worktree event storage, SSE, stale detection. BE-only |
| FEAT-046.2 | Dashboard and agent avatars | Four distinct SVG avatars, agent/task cards, timeline, pipeline, filters and responsive UI |
| FEAT-046.3 | Claude hooks and Codex reporting | Metadata-only Claude lifecycle adapter; explicit Codex reporting/command heartbeat; usage documentation. BE-only |

## Post-release backlog (P2)

High-level only; break down into sub-features when scheduled.

| ID | Feature | Stage |
|---|---|---|---|
| FEAT-100 | Additional ecommerce / courier connectors | Growth |
| FEAT-101 | Loyalty points, tiers and rewards | Growth |
| FEAT-102 | CRM segments and campaigns (SMS/WhatsApp) | Growth |
| FEAT-103 | Advanced promotions and markdown management | Growth |
| FEAT-104 | Rule-based replenishment and branch replenishment | Growth |
| FEAT-105 | Initial allocation and reallocation | Growth |
| FEAT-106 | Mobile warehouse workflows (receive, count, pick) | Growth |
| FEAT-107 | Purchase requisition and RFQ | Growth |
| FEAT-108 | Supplier analytics (lead time, fill rate, defects) | Growth |
| FEAT-109 | Expense management | Growth |
| FEAT-110 | Social commerce order integration | Growth |
| FEAT-111 | Demand forecasting (backtested) | Intelligence |
| FEAT-112 | Size curve recommendations | Intelligence |
| FEAT-113 | Transfer recommendations | Intelligence |
| FEAT-114 | Governed analytics assistant | Intelligence |
| FEAT-115 | Advanced WMS (bins, putaway, wave picking) | Enterprise |
| FEAT-116 | SSO | Enterprise |
| FEAT-117 | Multiple legal entities | Enterprise |
| FEAT-118 | Production / CMT | Enterprise |
| FEAT-119 | Finance and accounting module | Enterprise |

---

## Decisions blocking features

| ID | Decision | Blocks | Status |
|---|---|---|---|
| D-01 | Authentication provider | FEAT-002 and everything after | **Decided 2026-10-12: Better Auth** |
| D-02 | First ecommerce provider | FEAT-032, FEAT-033 | Open |
| D-02b | First courier provider | FEAT-035, FEAT-036, FEAT-037 | Open |
| D-03 | Offline POS stock-conflict policy | FEAT-030 | Open |
| D-04 | Inventory valuation method | FEAT-013.2, FEAT-018 | Open |
| D-05 | Tax applicability and export requirements | FEAT-024, FEAT-041.2 | Open |
| D-06 | Return / exchange policy | FEAT-029, FEAT-037 | Open |
| D-07 | Stock count cutoff / freeze policy | FEAT-015 | Open |
| D-08 | Payment provider scope | FEAT-026.4 | Open |
| D-08b | COD settlement matching rules | FEAT-036 | Open |
| D-09 | Pilot hardware (printers, scanners) | FEAT-007.4, FEAT-028 | Open |
