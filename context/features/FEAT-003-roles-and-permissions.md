# FEAT-003: Roles and permissions

Status: Implementation

## Requirement review (Minhaj)

**Sub-features:** FEAT-003.1, FEAT-003.2, FEAT-003.3, FEAT-003.4. FEAT-003.5 custom roles is P1 and deferred.

**Dependencies done:** FEAT-002 is Done.

**Sources checked:** `feature-list.md`, `architecture.md`, implemented FEAT-002 access model, Better Auth organization/RBAC guidance.

**Decisions:** Predefined roles are owner, admin, store manager, cashier, warehouse operator, purchaser, online order agent and accountant. Permissions are stable action identifiers shared by API and web. Owner/admin have tenant-wide administrative access. Operational roles receive least-privilege action sets. Cost visibility belongs to owner, admin, purchaser and accountant. An empty location assignment means tenant-wide access; one or more assignments restrict the member to exactly those active locations. Only owners may grant or remove ownership, and the last owner remains protected.

**Requirements approved:** yes — 2026-10-13

## Assignment (Minhaj)

**Execution lane:** Deep

**Why this lane / final verifier:** Authorization and tenant isolation are security boundaries. Run targeted unit/integration checks during implementation and one broad regression after freeze.

**User outcome:** Each staff account receives an understandable job role and optional location scope. The API rejects unauthorized actions even if the UI is bypassed, while the UI hides management links the member cannot use.

**In scope:** predefined roles, shared permission matrix, NestJS action guard metadata, location-scoped access, member role/scope administration, explicit cost permission.

**Out of scope:** custom roles and permission editors (P1), audit-log persistence (FEAT-004), feature-specific enforcement for modules not built yet.

**Acceptance criteria:**
- AC-1: All seven operational/administrative roles plus owner have deterministic permission sets.
- AC-2: Protected API actions return 403 when the active membership lacks the required permission.
- AC-3: Assigned locations are tenant-safe; scoped users cannot read or mutate another location.
- AC-4: Owners/admins can update member roles and location assignments, with last-owner and ownership protections.
- AC-5: Cost/margin data can be gated with `cost.view`, granted only to owner, admin, purchaser and accountant.
- AC-6: The web access UI uses returned permissions and supports role/location administration.

## Backend handoff

Implementation and verification in progress on `codex/FEAT-003-roles-permissions`.

## Frontend handoff

Implementation and verification in progress on `codex/FEAT-003-roles-permissions`.

## QA report

Pending implementation freeze.
