# First-release build plan

Status: proposed backlog order. Confirmed scope: multi-tenant SaaS, store retail and automated online integrations.

## 1. Resolve business contracts

Choose design partners and document workflows, location/register counts, catalog/order volume and hardware. Select one ecommerce provider and one courier. Decide offline stock policy, valuation, return policy, stock count cutoff, tax applicability, catalog authority, provider payment scope and COD settlement matching.

Output: reviewed requirements, state diagrams, acceptance criteria, architecture decisions, stack selection and staffing-based estimates.

## 2. Establish platform and catalog

Implement tenant/location access, migrations, audit, CI and basic deployment. Build style/color/size catalog, SKU/barcode generation, labels, import preview and customer/supplier masters.

Acceptance: a multi-color/multi-size style imports without duplicates; unauthorized tenant/location access fails; barcode selects the exact variant.

## 3. Implement inventory and procurement

Build movements, balance projections, reservations, cost/age provenance, opening stock, PO/partial receiving, adjustments, counts and dispatched/received transfers.

Acceptance: ledger reconstructs balances; repeated posting changes nothing; discrepancies and damaged receipts are explicit; transfers preserve aggregate quantity and age except recorded losses.

## 4. Complete store workflows

Build POS, shifts, split-tender records, basic discounts, reviewed tax calculation, receipts and receipt-linked returns/exchanges. Add offline queue behavior under the agreed policy.

Acceptance: sale/return/exchange quantities and money reconcile; return quantity cannot exceed eligible original quantity; reconnect/retry posts a queued sale once; hardware works on approved pilot devices.

## 5. Complete automated online workflows

Build external variant mappings, automated order intake, reservations, inventory publication, fulfillment, courier booking/tracking, COD settlement and physical return receipt. Include operational integration health and replay/reconciliation tools.

Acceptance: store sale updates online availability; online order affects POS available stock; duplicated/out-of-order events do not duplicate stock; cancellation releases once; failed calls recover; courier return restocks only after inspection; delivered COD orders remain outstanding until settlement matches.

Automated social DM/catalog integrations are additional contracts if selected by pilot demand; manual social order entry alone does not satisfy automated online scope.

## 6. Prepare pilot release

Add merchandising reports, stock history/aging, low-stock rules, in-app alerts, tenant onboarding/plan controls and exports. Verify backup restoration, permissions, concurrent sales, import reconciliation, integration drift, offline conflicts and end-of-day cash/COD totals.

Acceptance: a pilot brand can run warehouse, stores and automated online operations together with traceable reconciled stock. Establish support ownership and rollback/recovery procedures before wider launch.

## Estimates

Do not promise dates from the research's generic person-month figures. Estimate these work packages after provider, offline, tax, hardware, stack and staffing decisions. Track dependencies and acceptance gates, not just screen completion.
