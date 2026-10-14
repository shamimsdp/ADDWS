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

Implementation committed in `1471d6d` on `codex/FEAT-003-roles-permissions`. Agent work finished; BE layer is `Review` (human verification pending).

## Frontend handoff

Implementation committed in `1471d6d`. Agent work finished; FE layer is `Review` (human verification pending). Uncommitted test-fixture edits exist in `apps/api/scripts/auth-test-server.mjs` and `apps/web/e2e/helpers/fake-api.ts` (member role -> cashier; fake API returns permissions) and must be reviewed and committed by the branch owner.

## QA report

Independent focused review completed on frozen commit `1471d6d`.

**Checks run:**
- `pnpm --filter api exec vitest run --config vitest.config.ts src/auth/authorization.spec.ts src/tenancy/tenant.guard.spec.ts` — 2 files, 26 tests passed.
- Code review of the shared permission matrix, member-access transaction, controller permission/location metadata, scoped location listing and web permission gates/editor.
- The main verifier owns the separate broad integration/browser regression for this Deep lane.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Eight predefined roles map to unique, known permission identifiers; focused matrix tests passed. |
| AC-2 | PASS | `TenantGuard` enforces route metadata and returns `PERMISSION_REQUIRED` with HTTP 403; negative guard test passed. |
| AC-3 | PASS | Assignments validate active locations in the actor tenant, list queries filter to assigned IDs, and item routes reject out-of-scope IDs; focused tests passed. |
| AC-4 | PASS | The serialized access-update transaction rechecks the actor, restricts ownership changes to owners and protects the last owner. |
| AC-5 | PASS | `cost.view` is granted only to owner, admin, purchaser and accountant; focused matrix test passed. |
| AC-6 | PASS | Web navigation and admin gates consume returned permissions; the members page edits role and active-location assignments. |

**Bugs found:** None in the focused independent pass.

## Broad regression (main verifier, 2026-10-13) - INCOMPLETE

| Check | Result |
|---|---|
| lint, typecheck, build, unit tests (turbo) | PASS, 15/15 tasks |
| API integration suite (Neon test branch) | PASS, 189 tests, 11 files |
| Playwright | 53 passed, 1 failed, 25 skipped, 7 did not run |

**Open blocker (QA):** the real-login Playwright specs (`authentication.spec.ts` and others using `helpers/real-api.ts`) could not start because port 3001 is held by the user's own running dev API (PID 15096) and the harness refuses to kill an existing process. About 33 browser tests, including real-login and permission specs, are NOT yet run. The 1 failed test's cause is not yet recorded; the verifier must triage it.

**To unblock:** the user stops the dev API on port 3001 (or the harness is pointed at a free port), then the Playwright suite is rerun. Commit the pending fixture edits first so the run reflects final code.

**Status:** FEAT-003.1-.4 are NOT Done. QA layer = `In progress` until the browser regression passes and the human signs off. FEAT-003.5 (P1 custom roles) stays deferred.
