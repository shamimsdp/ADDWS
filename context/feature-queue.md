# Feature queue

Generated 2026-10-13 by `node scripts/feature-queue.mjs` from `feature-list.md` and `feature-progress-list.md`. **Do not edit by hand** — update those files and re-run.

Ranking rule: a feature that more other features depend on (directly or indirectly) goes first. Ties → P0 before P1 → earlier stage → lower ID.

## Overview

| Done | Core done | In progress | Ready to assign | Waiting on dependencies | Blocked by decisions |
|---|---|---|---|---|---|
| 5 | 0 | 0 | 5 | 37 | 0 |

## Next to assign (Minhaj)

Start each with a requirement review (status `Requirements`) before handing to Rabbi.

| # | Feature | Priority | Unlocks | Assignable sub-features | Blocked sub-features | First owner |
|---|---|---|---|---|---|---|
| 1 | FEAT-003 Roles and permissions | P0 | 37 | FEAT-003.1, FEAT-003.2, FEAT-003.3, FEAT-003.4, FEAT-003.5 | — | Rabbi |
| 2 | FEAT-027 Cash shifts and register | P0 | 8 | FEAT-027.1, FEAT-027.2, FEAT-027.3, FEAT-027.4, FEAT-027.5 | — | Rabbi |
| 3 | FEAT-038 Integration health and recovery | P0 | 0 | FEAT-038.1, FEAT-038.2, FEAT-038.3 | — | Rabbi |
| 4 | FEAT-042 Localization | P0 | 0 | FEAT-042.1, FEAT-042.2, FEAT-042.3 | — | Rabbi |
| 5 | FEAT-045 Backup and operational recovery | P0 | 0 | FEAT-045.1, FEAT-045.2, FEAT-045.3 | — | Rabbi |

## Work queues by responsibility

### Minhaj — project manager

**Requirement reviews in progress:**
_None._

**Bugs waiting for triage (no BUG ID yet):**
_None._

**Ready to close (QA passed):**
_None._

**Decisions to request from the user (ranked by what they unblock):**

| Decision | Feature | Blocked sub-features | Features held back |
|---|---|---|---|
| D-05 | FEAT-024 Tax calculation | FEAT-024.1, FEAT-024.2, FEAT-024.3, FEAT-024.4 | 8 |
| D-02 | FEAT-032 Ecommerce catalog mapping and stock publication | FEAT-032.1, FEAT-032.2, FEAT-032.3, FEAT-032.4 | 7 |
| D-02 | FEAT-033 Online order intake | FEAT-033.1, FEAT-033.2, FEAT-033.3, FEAT-033.4, FEAT-033.5, FEAT-033.6 | 6 |
| D-02b | FEAT-035 Courier booking and tracking | FEAT-035.1, FEAT-035.2, FEAT-035.3, FEAT-035.4 | 2 |
| D-06 | FEAT-029 Returns and exchanges | FEAT-029.1, FEAT-029.2, FEAT-029.3, FEAT-029.4, FEAT-029.5 | 1 |
| D-09 | FEAT-007 Barcodes and labels | FEAT-007.4 | 0 |
| D-08 | FEAT-026 Payments and split tender | FEAT-026.4 | 0 |
| D-04 | FEAT-013 Opening stock | FEAT-013.2 | 0 |
| D-07 | FEAT-015 Stock count | FEAT-015.1, FEAT-015.2, FEAT-015.3, FEAT-015.4 | 0 |
| D-04 | FEAT-018 Cost layers and aging | FEAT-018.1, FEAT-018.2, FEAT-018.3, FEAT-018.4 | 0 |
| D-09 | FEAT-028 Receipts and printing | FEAT-028.1, FEAT-028.2, FEAT-028.3 | 0 |
| D-03 | FEAT-030 Offline POS | FEAT-030.1, FEAT-030.2, FEAT-030.3, FEAT-030.4 | 0 |
| D-08b | FEAT-036 COD settlement reconciliation | FEAT-036.1, FEAT-036.2, FEAT-036.3, FEAT-036.4 | 0 |
| D-06 | FEAT-037 Online returns | FEAT-037.1, FEAT-037.2, FEAT-037.3 | 0 |
| D-05 | FEAT-041 Exports | FEAT-041.2 | 0 |

### Rabbi — backend

_None._

### Shamim — frontend

_None._

### Tanvir — QA

_None._

## In progress

_None._

## Waiting on dependencies

| Feature | Unlocks | Waiting for |
|---|---|---|
| FEAT-005 Catalog masters | 32 | FEAT-003 |
| FEAT-006 Product catalog and variant matrix | 30 | FEAT-005 |
| FEAT-012 Inventory ledger and balances | 22 | FEAT-006 |
| FEAT-022 Pricing and price lists | 9 | FEAT-006 |
| FEAT-007 Barcodes and labels | 8 | FEAT-006 |
| FEAT-017 Reservations and availability | 8 | FEAT-012 |
| FEAT-023 Basic discounts | 8 | FEAT-022 |
| FEAT-024 Tax calculation | 8 | FEAT-005 |
| FEAT-025 POS checkout | 7 | FEAT-007.2, FEAT-012, FEAT-022, FEAT-023, FEAT-024, FEAT-027 |
| FEAT-032 Ecommerce catalog mapping and stock publication | 7 | FEAT-006, FEAT-017 |
| FEAT-010 Supplier master | 6 | FEAT-003 |
| FEAT-033 Online order intake | 6 | FEAT-032, FEAT-017 |
| FEAT-019 Purchase orders | 3 | FEAT-010, FEAT-006 |
| FEAT-026 Payments and split tender | 3 | FEAT-025 |
| FEAT-034 Fulfilment | 3 | FEAT-033 |
| FEAT-011 Customer master | 2 | FEAT-003 |
| FEAT-020 Goods receipt | 2 | FEAT-019, FEAT-012 |
| FEAT-035 Courier booking and tracking | 2 | FEAT-034 |
| FEAT-009 Data import | 1 | FEAT-006, FEAT-010, FEAT-011 |
| FEAT-029 Returns and exchanges | 1 | FEAT-025, FEAT-026 |
| FEAT-039 Reports | 1 | FEAT-012, FEAT-025, FEAT-033 |
| FEAT-004 Audit log | 0 | FEAT-003 |
| FEAT-013 Opening stock | 0 | FEAT-012 |
| FEAT-014 Stock adjustments | 0 | FEAT-012 |
| FEAT-015 Stock count | 0 | FEAT-012 |
| FEAT-016 Transfers | 0 | FEAT-012 |
| FEAT-018 Cost layers and aging | 0 | FEAT-012, FEAT-020 |
| FEAT-028 Receipts and printing | 0 | FEAT-025 |
| FEAT-030 Offline POS | 0 | FEAT-025, FEAT-026, FEAT-027 |
| FEAT-036 COD settlement reconciliation | 0 | FEAT-035 |
| FEAT-037 Online returns | 0 | FEAT-035, FEAT-029.3 |
| FEAT-040 Low stock rules and alerts | 0 | FEAT-012 |
| FEAT-041 Exports | 0 | FEAT-039 |
| FEAT-043 Tenant onboarding | 0 | FEAT-003, FEAT-009 |
| FEAT-044 SaaS administration | 0 | FEAT-003 |
| FEAT-008 Product media | 0 | FEAT-006 |
| FEAT-021 Supplier returns | 0 | FEAT-020 |

## Blocked by decisions

_None._

## Done

- FEAT-000 Project setup
- FEAT-001 Tenancy and organization
- FEAT-002 Authentication and user management
- FEAT-031 Integration framework
- FEAT-046 Local agent dashboard

## Full build order (remaining features)

Wave = earliest point a feature can start (all its dependencies are in earlier waves). Features in the same wave can run in parallel.

| Order | Wave | Feature | Priority | Unlocks | Depends on | State |
|---|---|---|---|---|---|---|
| 1 | 1 | FEAT-003 Roles and permissions | P0 | 37 | FEAT-002 | Ready |
| 2 | 1 | FEAT-027 Cash shifts and register | P0 | 8 | FEAT-001.4, FEAT-002.5 | Ready |
| 3 | 1 | FEAT-038 Integration health and recovery | P0 | 0 | FEAT-031 | Ready |
| 4 | 1 | FEAT-042 Localization | P0 | 0 | FEAT-000.5 | Ready |
| 5 | 1 | FEAT-045 Backup and operational recovery | P0 | 0 | FEAT-000.3 | Ready |
| 6 | 2 | FEAT-005 Catalog masters | P0 | 32 | FEAT-001, FEAT-003 | Waiting |
| 7 | 2 | FEAT-010 Supplier master | P0 | 6 | FEAT-001, FEAT-003 | Waiting |
| 8 | 2 | FEAT-011 Customer master | P0 | 2 | FEAT-001, FEAT-003 | Waiting |
| 9 | 2 | FEAT-004 Audit log | P0 | 0 | FEAT-001, FEAT-003 | Waiting |
| 10 | 2 | FEAT-044 SaaS administration | P0 | 0 | FEAT-001, FEAT-003 | Waiting |
| 11 | 3 | FEAT-006 Product catalog and variant matrix | P0 | 30 | FEAT-005 | Waiting |
| 12 | 3 | FEAT-024 Tax calculation | P0 | 8 | FEAT-005 | Waiting |
| 13 | 4 | FEAT-012 Inventory ledger and balances | P0 | 22 | FEAT-006, FEAT-001.4 | Waiting |
| 14 | 4 | FEAT-022 Pricing and price lists | P0 | 9 | FEAT-006 | Waiting |
| 15 | 4 | FEAT-007 Barcodes and labels | P0 | 8 | FEAT-006 | Waiting |
| 16 | 4 | FEAT-019 Purchase orders | P0 | 3 | FEAT-010, FEAT-006 | Waiting |
| 17 | 4 | FEAT-009 Data import | P0 | 1 | FEAT-006, FEAT-010, FEAT-011 | Waiting |
| 18 | 4 | FEAT-008 Product media | P1 | 0 | FEAT-006 | Waiting |
| 19 | 5 | FEAT-017 Reservations and availability | P0 | 8 | FEAT-012 | Waiting |
| 20 | 5 | FEAT-023 Basic discounts | P0 | 8 | FEAT-022 | Waiting |
| 21 | 5 | FEAT-020 Goods receipt | P0 | 2 | FEAT-019, FEAT-012 | Waiting |
| 22 | 5 | FEAT-013 Opening stock | P0 | 0 | FEAT-012 | Waiting |
| 23 | 5 | FEAT-014 Stock adjustments | P0 | 0 | FEAT-012 | Waiting |
| 24 | 5 | FEAT-015 Stock count | P0 | 0 | FEAT-012 | Waiting |
| 25 | 5 | FEAT-016 Transfers | P0 | 0 | FEAT-012 | Waiting |
| 26 | 5 | FEAT-040 Low stock rules and alerts | P0 | 0 | FEAT-012 | Waiting |
| 27 | 5 | FEAT-043 Tenant onboarding | P0 | 0 | FEAT-001, FEAT-003, FEAT-009 | Waiting |
| 28 | 6 | FEAT-025 POS checkout | P0 | 7 | FEAT-007.2, FEAT-012, FEAT-022, FEAT-023, FEAT-024, FEAT-027 | Waiting |
| 29 | 6 | FEAT-032 Ecommerce catalog mapping and stock publication | P0 | 7 | FEAT-031, FEAT-006, FEAT-017 | Waiting |
| 30 | 6 | FEAT-018 Cost layers and aging | P0 | 0 | FEAT-012, FEAT-020 | Waiting |
| 31 | 6 | FEAT-021 Supplier returns | P1 | 0 | FEAT-020 | Waiting |
| 32 | 7 | FEAT-033 Online order intake | P0 | 6 | FEAT-032, FEAT-017 | Waiting |
| 33 | 7 | FEAT-026 Payments and split tender | P0 | 3 | FEAT-025 | Waiting |
| 34 | 7 | FEAT-028 Receipts and printing | P0 | 0 | FEAT-025 | Waiting |
| 35 | 8 | FEAT-034 Fulfilment | P0 | 3 | FEAT-033 | Waiting |
| 36 | 8 | FEAT-029 Returns and exchanges | P0 | 1 | FEAT-025, FEAT-026 | Waiting |
| 37 | 8 | FEAT-039 Reports | P0 | 1 | FEAT-012, FEAT-025, FEAT-033 | Waiting |
| 38 | 8 | FEAT-030 Offline POS | P0 | 0 | FEAT-025, FEAT-026, FEAT-027 | Waiting |
| 39 | 9 | FEAT-035 Courier booking and tracking | P0 | 2 | FEAT-034, FEAT-031 | Waiting |
| 40 | 9 | FEAT-041 Exports | P0 | 0 | FEAT-039 | Waiting |
| 41 | 10 | FEAT-036 COD settlement reconciliation | P0 | 0 | FEAT-035 | Waiting |
| 42 | 10 | FEAT-037 Online returns | P0 | 0 | FEAT-035, FEAT-029.3 | Waiting |
