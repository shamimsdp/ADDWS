# Code standards

Status: shared standards for the approved TypeScript, NestJS, Next.js and Prisma stack. Apply these rules across frontend, backend and workers.

- Keep domain operations in explicit application services; UI and provider adapters must not directly mutate inventory balances.
- Use database transactions and constraints for business invariants; UI checks are supplementary.
- Scope all entity references and uniqueness rules correctly by tenant; enforce authorized location access server-side.
- Represent money with exact decimal arithmetic or documented integer minor units. Do not use binary floating point for settlement/tax calculations.
- Store UTC instants plus business timezone context; distinguish event time, posting time and local business date.
- Preserve original document price, tax, discount and cost snapshots.
- Use stable opaque IDs. Human document numbers are separate and uniquely scoped.
- Explicitly validate state transitions; never overload one status with payment, order and shipment meanings.
- Make posting operations idempotent. Version provider payload contracts and mapping records.
- Use structured errors, correlation IDs and redacted logs. Expose recoverable exceptions without leaking credentials or customer data.
- Keep migrations reviewable and compatible with deployment/backfill plans. Never silently alter posted financial/stock history.
- Centralize metric definitions, permissions, tax calculations and rounding policies.
- Test concurrent last-unit sales/reservations, duplicate sync, partial receipts/transfers, returns, costing, tenant boundaries and webhook replay.
- Verify accessibility and high-frequency operator flows. Establish formatting/lint/type/build checks once the stack is chosen.
