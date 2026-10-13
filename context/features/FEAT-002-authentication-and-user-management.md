# FEAT-002: Authentication and user management

Status: Done (2026-10-13)

## Requirement review (Minhaj)

**Sub-features:** FEAT-002.1 Sign-in / sign-out / sessions; FEAT-002.2 Password reset and email verification; FEAT-002.3 User invitation and deactivation; FEAT-002.4 Mandatory MFA for owner/admin (promoted to required P0); FEAT-002.5 Device / register sign-in for POS.

**Dependencies done:** FEAT-001 Tenancy and organization is Done, including all five sub-features. FEAT-000 setup and FEAT-031 integration framework are also Done. FEAT-003 granular roles/location permissions, FEAT-004 persistent audit viewer, FEAT-027 cash shifts, FEAT-030 offline POS and FEAT-043 public tenant onboarding are not implemented and must not be assumed available.

**Sources checked:**

- `CLAUDE.md`, `.claude/agents/minhaj-project-manager.md`, `context/feature-list.md`, `feature-progress-list.md`, `feature-queue.md`, `task-board.md` and `features/_template.md`.
- `context/project-overview.md`, `progress-tracker.md`, `roadmap.md`, `build-plan.md`, `architecture.md`, `project-rules.md`, `workflow.md`, `code-standards.md` and `Library-docs.md`.
- `context/features/FEAT-001-tenancy-and-organization.md`: approved own Tenant table, 1:1 Better Auth organization mapping, provisional tenant-header resolver and its planned replacement.
- `context/ui-rules.md`, `ui-tokens.md` and `ui-registry.md`: reuse form, notice, confirmation and error-state components; remove the development tenant switcher from normal authenticated flows.
- Root product specification section 26 (roles, MFA, device/session management; enterprise SSO later), deep research security scope, Compass section 4.23 (owner 2FA, staff PINs, POS device binding). Discovery is not approval; user answers below now resolve the MFA priority and staff sign-in differences.
- Current official Better Auth docs reviewed by root on 2026-10-12: [organization](https://better-auth.com/docs/plugins/organization), [email/password](https://better-auth.com/docs/authentication/email-password), [Prisma adapter](https://better-auth.com/docs/adapters/prisma), [sessions](https://better-auth.com/docs/concepts/session-management), [two-factor](https://better-auth.com/docs/plugins/2fa). Verify compatibility with the installed version during implementation.
- MCP graph discovery located `TenantGuard`, `RequestContext` and `TenantProvisioningService`. The existing guard resolves only an explicitly gated development/test header, currently gives interim admin capability and has no authenticated actor. Root technical review confirms Better Auth is not installed yet; official organization/email documentation was reviewed. Implementation must verify the installed version and current official APIs, including organization hooks, rather than copying stale skill examples.

**Gap checklist:**

- [x] User roles and permissions: Q1 covers member administration. Only bootstrap owner/admin/member capabilities needed here; full business role/action/location rules remain FEAT-003. Administrative capability comes from verified membership, never a client flag.
- [x] Business rules and policies: Q1 access model, Q2 mandatory privileged MFA and Q3 named email/password register sign-in approved by the user below.
- [x] Data fields, validation, uniqueness: routine defaults R2; invitation identity and membership are tenant-scoped while login identity is global; membership/device rows require tenant-safe references.
- [x] States and transitions: pending/accepted/revoked/expired invitation, active/deactivated membership, valid/expired/revoked session, and pending/approved/revoked device. MFA enabled/disabled/challenge/recovery depends on Q2.
- [x] Failure, edge and concurrency cases: replayed invitations/reset links, duplicate acceptance, last-owner races, membership deactivation during an open session, tenant switching, email-delivery failure and expired devices must fail safely.
- [x] Tenant and location scope: approved own Tenant + 1:1 organization; session-selected tenant must be revalidated server-side. Q3 binds devices to an active store. Full staff location assignments remain FEAT-003.
- [x] Money / tax / timezone rules: no monetary operation; expiry timestamps are UTC instants, rendered using existing timezone helpers. No business-date or tax changes.
- [x] Audit needs: actor/tenant/action/correlation identifiers through existing redacted structured logging; persistent audit viewer remains FEAT-004. Never log credentials, tokens, PINs, MFA seeds or recovery codes.
- [x] UI screens and flows: sign-in/out, verification, reset request/complete, invitation acceptance, tenant selection, members, sessions; MFA and registered-device screens according to Q2/Q3. Loading/error/empty/expired/denied states, labels and keyboard focus required.
- [x] Integrations: Better Auth server in NestJS, Prisma adapter, React client in Next.js, organization plugin; MFA plugin if chosen. Configurable SMTP delivery and a local test transport; production sender credentials are deployment configuration, not a requirements blocker.
- [x] Open decisions (D-xx): D-01 Better Auth and feature-local Q1-Q3 decided. No unrelated D-02 through D-09 policy is required for this feature.

**Gaps found — routine decisions:**

| # | Gap | Type | Final answer and reason | Decided by |
|---|---|---|---|---|
| R1 | Auth boundary and tenant selection | Routine | Keep the approved own Tenant table and 1:1 organization mapping. Derive actor, active tenant and admin capability from a server-verified session and current active membership. Reject missing membership or suspended tenant. Replace the interim header resolver in normal app flows; header input cannot override a real session. Public auth/health routes remain explicitly exempt. Reason: implement the previously approved tenancy boundary without impersonation. | Minhaj, 2026-10-12 |
| R2 | Input and token validation | Routine | Trim/normalize email consistently; case-insensitive unique login email, names 1-100 characters, password 12-128 characters without trimming. Reject NUL/malformed inputs. Use library-supported password hashing and cryptographically random expiring one-use links. Default reset validity one hour; invitation validity seven days; verification validity 24 hours. Tokens/codes are never exposed in normal API payloads or logs. Reason: reversible validation defaults and safe library primitives. | Minhaj, 2026-10-12 |
| R3 | Web/session transport | Routine | HttpOnly cookie sessions, secure cookies in production, explicit trusted origins and redirect allowlist, CSRF/origin protection and credentialed browser requests. No bearer token in localStorage. Disable auth cookieCache; check current membership and device state on protected requests. General web session default seven days; registered POS sessions have a non-sliding 12-hour absolute expiry per Q3. Reason: secure browser transport with immediate authorization revocation. | Minhaj, 2026-10-12 |
| R4 | Email transport and delivery failure | Routine | Provider-neutral configurable SMTP adapter with non-network capture transport for tests/local development. Missing production delivery configuration fails closed for mail-dependent actions; never return reset/verification links to substitute for delivery. Surface a retryable delivery failure without account enumeration. No provider account provisioning is authorized by this feature. Reason: avoid tying auth behaviour to an undecided paid service. | Minhaj, 2026-10-12 |
| R5 | Reset, enumeration and rate limits | Routine | Generic reset/resend responses; rate-limit authentication and recovery attempts; validate before side effects. Successful password reset invalidates existing user sessions. Replayed/expired reset links cannot change credentials. Invitation acceptance requires the authenticated/verified email matching the invited email. Reason: recovery cannot bypass identity verification. | Minhaj, 2026-10-12 |
| R6 | Migration and existing data | Routine | Add auth/membership schemas without changing domain Tenant identifiers. Backfill/link existing tenants once with a unique tenant-to-organization constraint. Provision both through controlled internal paths; public tenant creation remains FEAT-043. Dev/test seed owners and members use fictional test identities and guarded data setup; never ship a universal production password. Reason: preserve existing tenant data and scope boundaries. | Minhaj, 2026-10-12 |
| R7 | Logging and component reuse | Routine | Use current structured redacted logging and shared UI primitives/i18n keys; register new implemented components at frontend handoff. Do not build the FEAT-004 audit viewer, enterprise SSO/IP rules or social login without an explicit scope decision. Reason: avoid duplicate components and unrelated features. | Minhaj, 2026-10-12 |

**Gaps found — user decisions answered 2026-10-12:**

| # | Gap | Type | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| Q1 | How brands and staff gain access | Business | Invitation-only email/password for existing tenants, verified email, tenant-local member management; public signup remains FEAT-043. | Approved recommended option: owners/admins invite/deactivate members; people can belong to multiple tenants; deactivation affects only that tenant; preserve last active owner. No public signup/social login now. | User, 2026-10-12 |
| Q2 | Owner/admin MFA delivery and enforcement | Business | Mandatory TOTP plus one-use recovery codes now. | Approved mandatory owner/admin MFA now. FEAT-002.4 promoted to required P0 delivery. Enforce completed second-factor verification for privileged access, not merely an enrollment flag. | User, 2026-10-12 |
| Q3 | Shared POS device/cashier identity | Business | Individual email/password on approved store-bound browsers; 12-hour maximum and immediate revocation. | Approved named staff email/password on owner/admin-approved browser tied to an active store; 12-hour absolute POS session and immediate loss of POS access on device revocation. No shared account, staff PIN or offline authentication now. Cash shifts remain FEAT-027. | User, 2026-10-12 |

**Requirements approved:** yes (2026-10-12) — user selected all three recommended options through the root session's questions. No open business gap remains.

## Assignment (Minhaj)

**Assigned to:** Rabbi first (backend/schema/unit tests), followed by Shamim (frontend/browser tests), Tanvir (independent full-feature QA), Minhaj (closure).

**User outcome:** People safely access existing clothing-brand tenants with verified named identities, recover access and manage their team. Owners/admins complete MFA; staff use approved store browsers for POS access with a maximum 12-hour session.

**In scope:** All FEAT-002.1-.5: authenticated tenant boundary, invitation-only identity creation for existing tenants, sign-in/out and session management, email verification/reset, invitations and tenant-local deactivation, mandatory owner/admin TOTP/recovery, approved store-bound browser enrollment/revocation and named POS authentication.

**Out of scope:** Public tenant onboarding FEAT-043, SaaS billing/admin FEAT-044, complete granular roles and staff location assignment FEAT-003, audit viewer FEAT-004, cash shift accounting FEAT-027, offline stock/auth FEAT-030, social login and enterprise SSO unless explicitly selected.

**Acceptance criteria:**

- AC-1: A valid named user signs in and signs out; expired/revoked sessions are rejected server-side and UI returns to a clear sign-in state.
- AC-2: Tenant selection exposes only the user's active memberships; forged headers, organization IDs or cross-tenant references cannot select another tenant. Suspended tenants remain denied.
- AC-3: Verification and recovery use expiring one-use links, generic enumeration-safe responses and rate limits. Reset revokes old sessions; malformed/replayed links do not mutate accounts.
- AC-4: Only MFA-verified owners/admins invite staff or deactivate members. Identity creation requires a valid invitation or controlled internal bootstrap; no unrestricted sign-up/organization creation endpoint is usable. Duplicate acceptance creates at most one membership; mismatched email, revoked or expired invitations cannot grant access.
- AC-5: Tenant-local deactivation blocks the next protected request, leaves other tenant memberships usable and cannot remove or demote the last active owner even under concurrent attempts. Member management cannot self-escalate or manufacture an owner membership; ownership transfer is outside this feature.
- AC-6: Owners/admins cannot access protected domain operations or organization/member administration until that session completes a second-factor challenge. MFA enrollment/status/security recovery endpoints remain reachable to an authenticated user before tenant work. Enrollment alone is insufficient. Fresh login using a valid one-use recovery code satisfies the second factor; replay fails. Disabling/resetting MFA cannot grant privileged access without renewed enrollment/challenge; secrets and recovery codes are never logged.
- AC-7: Only MFA-verified owners/admins approve or revoke browsers for their tenant's active store locations. POS sessions identify the individual staff member and approved device, are scoped to the bound store, expire absolutely after 12 hours and cannot slide/refresh past that limit. Revoked devices, deactivated memberships or inactive locations lose POS access on the next request. Device possession alone grants no backoffice/admin rights. No staff PIN, offline authentication or cash shift operation is added.
- AC-8: Loading/error/expired/permission states are accessible; no normal authenticated flow uses the old dev tenant switcher; tenant and signed-in identity are visible. Existing organization and integrations screens work with real sessions.
- AC-9: Safe migration/backfill preserves existing tenant data and IDs. Unit, test-branch integration and actual-browser tests exercise real auth cookies and cross-tenant boundaries, without production database access or committed credentials.

**Backend tasks (Rabbi):**

1. Pin Better Auth after checking official current NestJS/Prisma/plugin APIs and compatibility. Add auth/membership/MFA/device schemas and a reviewable migration, unique 1:1 Tenant mapping, tenant-safe references and guarded seed/backfill paths.
2. Mount auth handlers with correct body/cookie/origin handling. Restrict sign-up and organization creation to approved invitation/internal paths. Preserve health/webhook/internal-worker exemptions; replace interim tenant authentication while preserving tenant suspension enforcement and actor logging.
3. Implement session/current-membership tenant resolution, member list/invite/revoke/deactivate controls, server-protected owner invariants and matching-email one-use acceptance. Use bootstrap owner/admin/member roles only; FEAT-003 owns operational roles and location assignment.
4. Implement verification/reset delivery adapter, replay/expiry/rate limits and session invalidation. Add mandatory privileged second-factor session enforcement to domain APIs and plugin management endpoints; use current organization hooks and disable cookieCache.
5. Implement browser enrollment/approval/revocation and named online POS authentication with fixed store/device context and absolute 12-hour session expiry. Define and export shared contracts/error states.
6. Run unit and Neon-test-branch integration checks for all invariants, migration compatibility and existing endpoint regressions. Fill Backend handoff with exact endpoints, cookies/origins, fake-email test interface and frontend error states before handing to Shamim.

**Frontend tasks (Shamim):** After backend handoff: auth client/forms; sign-in/out, verification/reset/invitation acceptance, identity/tenant selection, member/session management, mandatory MFA enrollment/challenge/recovery and device approval/revocation/sign-in. Protect organization/integrations screens, clear tenant data on switching/sign-out and remove the interim switcher from normal flows. Use current UI primitives/i18n, register implemented components and run real-cookie Playwright tests with captured test email links.

**QA focus (Tanvir):** Authentication bypass, tenant isolation and stale authorization; session/deactivation/device revocation; owner races; reset/invitation replay and email mismatch; CSRF/redirect/origin abuse; no account enumeration/secrets in logs; policy-specific MFA and POS tests; meaningful actual-browser coverage.

## Backend handoff (Rabbi)

Implemented and verified by Codex acting as Rabbi, 2026-10-13. Backend handoff complete; assigned to Shamim for frontend and real-browser delivery. The final register-cookie/POS smoke check also passed after the root-path cookie change.

**Built:** `apps/api/src/auth/` (Better Auth factory, current-session/membership boundary, transactional invitations/deactivation, register service, custom access controller, SMTP/capture mail adapter and guarded owner bootstrap), shared DTOs in `packages/shared/src/auth.ts`, authenticated `TenantGuard`, credential/origin/rate-limit protection, secret-redacted logging and an exact raw auth allowlist mounted before Nest body parsing. Pinned Better Auth 1.7.7, Nodemailer 10.1.0 and types 8.0.2 through the workspace catalog.

**Database:** migration `20261012220000_authentication` adds global user/account/session/verification/MFA tables, mapped organizations/members/invitations, register devices/POS grants, persistent rate limits and one-use verified-email hashes. It preserves tenant IDs and backfills organizations with the same UUID once, with a unique tenant mapping/check. Store/device links use composite tenant-safe foreign keys; checks constrain normalized email, role/status and POS deadlines. New internal provisioning/guarded seeds create organizations atomically. Migration applied only to the actual verified Neon test branch through `db:migrate:deploy:test`; development/production rollout is a later deployment operation. Root added a fail-closed migration helper, three safety tests and guarded CI migration wiring.

**Transport/security for Shamim:** use `credentials: 'include'` to the API origin, no bearer token/localStorage. All custom mutations require the exact trusted web `Origin`; normal forms fetch from the browser. Configure `WEB_ORIGIN` and `BETTER_AUTH_URL` for the actual frontend/API host/ports, with HTTPS in production. Better Auth session cookie is HttpOnly, production Secure, seven days; `ims.register` is a separate HttpOnly/SameSite Lax/production Secure cookie with `/` path. Session tokens are removed from successful browser JSON and never used for UI revocation. Reset/verification/invitation links and device secrets are absent from normal API responses. TOTP URI/recovery codes are intentional authenticated setup responses only; generate QR locally. Legacy tenant headers work only in isolated `NODE_ENV=test` + explicit opt-in + no Cookie/Authorization fixtures; development/production and real-cookie tests use real auth.

**Raw library endpoints** (`/api/auth`, successful POSTs normally 200; library errors `{code,message}`):

| Method/path | Request / result | Boundary |
|---|---|---|
| POST `/sign-in/email` | `{email,password}`; normal user result, or `{twoFactorRedirect:true,...}` | Verified-email password identity; MFA-enabled users have no session until challenge succeeds |
| POST `/sign-out` | `{}`; success | Deletes current session/cookie |
| GET `/get-session` | Sanitized library session/user or null | Cookie identity; prefer `/access/me` for tenant/session/MFA decisions |
| POST `/request-password-reset` | `{email,redirectTo: trusted absolute web reset URL}`; generic success | Enumeration-safe, rate-limited; configured-delivery absence is generic retryable 503 |
| GET `/reset-password/:token` | Emailed link redirects to the trusted web callback with token | Valid pending one-hour reset |
| POST `/reset-password` | `{token,newPassword}` | One-use; revokes all prior user sessions |
| POST `/send-verification-email` | `{email,callbackURL: trusted absolute web URL}`; generic response | Verification resend |
| GET `/verify-email?token=...&callbackURL=...` | Emailed 24-hour link; redirect to callback | Valid signed one-use token, redirect allowlist |
| POST `/two-factor/enable` | `{password}` → `{method,totpURI,backupCodes}` | Authenticated enrollment; grants no tenant access yet |
| POST `/two-factor/verify-totp` | `{code}` → success | Current enrollment or pending sign-in challenge; verifies THIS session |
| POST `/two-factor/verify-backup-code` | `{code}` → success | One-use recovery challenge; verifies THIS session |
| POST `/two-factor/get-totp-uri` | `{password}` → URI | Enrollment; already enabled secrets require a verified second factor |
| POST `/two-factor/generate-backup-codes` | `{password}` → replacement codes | Verified MFA session; old codes replaced |
| POST `/two-factor/disable` | `{password}` → success | Verified enrolled session; clears all user-session MFA markers |

Do not use raw organization/member APIs, signup, generic user/session update, social login, trusted-device bypass or `disableSession` on backup verification: these are unavailable. Configure the React Better Auth client with `twoFactorClient` at the same API `/api/auth` base; custom tenant/member/register operations use `/access` below. A successful MFA challenge does not automatically select a tenant; query `/access/me` and select an authorized tenant. An authenticated non-enrolled owner can select a tenant but domain/admin endpoints return `MFA_REQUIRED` until verified. A fresh enrolled-user login returns `twoFactorRedirect` and `/access/me` is 401 until verified.

**Custom endpoints** (`GET` 200, successful `POST` 201; existing structured API error envelope):

| Method/path | Body / response | Requirement |
|---|---|---|
| GET `/access/me` | `AuthMeDto`: named user, `{session:{id,expiresAt,mfaVerified}}`, activeTenantId/null and active memberships | Verified identity; works before privileged MFA |
| POST `/access/tenant` | `{tenantId}` → `{tenantId}` | Current membership in active tenant; clears UI's prior tenant data on success |
| GET `/access/members` | `MembersDto` (members and last 100 invitations) | MFA-verified owner/admin |
| POST `/access/invitations` | `InviteInput {email,role?:'admin'|'member'}` → `{id,email,role,expiresAt}` | MFA-verified owner/admin; emails token without returning it |
| POST `/access/invitations/:id/revoke` | `{}` → `{success:true}` | Same-tenant MFA administrator |
| GET `/access/invitation?token=...` | `InvitationInfoDto {email,role,businessName,expiresAt}` | Public bearer invitation secret; valid pending/unexpired active tenant |
| POST `/access/invitation/register` | `InvitedRegistrationInput {token,name,password}` → `{success:true}` | Public valid invitation + trusted Origin; creates unverified account, no membership |
| POST `/access/invitation/accept` | `{token}` → `{membershipId}` | Authenticated verified matching email; atomic one-use membership |
| POST `/access/members/:id/deactivate` | `{}` → `{success:true}` | Same-tenant MFA administrator; last active owner protected |
| GET `/access/sessions` | `{sessions:AuthSessionDto[]}` | Own live sessions; includes current flag, IDs, dates and userAgent, no secret tokens |
| POST `/access/sessions/:id/revoke` | `{}` → `{success:true}` | Only own session; next request with revoked cookie is rejected |
| GET `/access/devices` | `{devices:RegisterDeviceDto[]}` | Same-tenant MFA administrator |
| POST `/access/devices/enroll` | `RegisterEnrollmentInput {locationId,label}` → `{device}` + HttpOnly browser cookie | Active member in selected tenant; active same-tenant store; creates pending browser |
| POST `/access/devices/:id/approve` or `/revoke` | `{}` → `{success:true}` | Same-tenant MFA administrator; approval rechecks actor/session/store transactionally |
| GET `/access/pos/browser` | `{device:RegisterDeviceDto|null}` | Current membership; displays this browser's pending/approved/revoked state |
| POST `/access/pos/start` | `{}` → `PosContextDto` | Named verified user + approved browser + active store/current membership |
| GET `/access/pos/context` | `PosContextDto` | Revalidates tenant/member/device/store and fixed grant on each request |

Shared types/errors live in `@ims/shared`. Relevant custom states: `AUTH_SESSION_REQUIRED` (401), `TENANT_CONTEXT_REQUIRED` (401/select tenant), `MEMBERSHIP_REQUIRED`, `TENANT_SUSPENDED`, `TENANT_ADMIN_REQUIRED`, `MFA_REQUIRED` (403), `INVITATION_INVALID` (400 expired/revoked/replay), `INVITATION_EMAIL_MISMATCH` (403), `ACCOUNT_EXISTS` (409: sign in or reset/resend the invited account), `MEMBER_ALREADY_EXISTS`/`LAST_OWNER_REQUIRED` (409), `REGISTER_APPROVAL_REQUIRED` (403), `REGISTER_LOCATION_INVALID` (404/409), `REGISTER_REQUIRED` (404/409), `POS_SESSION_EXPIRED` (401), `AUTH_DELIVERY_FAILED` (503/retry), `INVALID_ORIGIN` (403), `INVALID_TOKEN`/`VALIDATION_FAILED` (400), and `TOO_MANY_REQUESTS` (429). Library states include `EMAIL_NOT_VERIFIED`, `INVALID_EMAIL_OR_PASSWORD`, `INVALID_CODE`, `INVALID_BACKUP_CODE` and expiry errors: display safe messages, never raw provider details.

**Mail/fixtures for browser tests:** `AuthMailService.captured` contains `{email,kind:'verification'|'reset'|'invitation',url}` only in local/test process memory; there is no customer-accessible capture route. A separate test-only harness may expose fixture/mail operations only under an explicit test secret, loopback binding and actual Neon test-branch guard. `apps/api/src/testing/auth-fixtures.ts` demonstrates guarded random-password fictional identities; it is excluded from the production build. Configure API URL to the actual harness port so emailed links work in real browsers. New public registration is unavailable: bootstrap fixtures, invite, register if needed, verify the captured mail link, sign in and accept with matching email. Existing invited accounts use sign-in/reset/resend instead of registration. Reset request must include a trusted frontend reset URL. Setup MFA by reading the URI in the browser/harness and deriving a real RFC6238 code locally; recovery codes are one-use. Never record these secrets in screenshots or commit fixtures/storage files.

**Validation:** API unit suite **403 passed** with V8 coverage reported (59.29% statements; critical transactional/library flows additionally covered by DB integration); DB unit suite **16 passed**; full real-DB API integration **188 passed** (all 170 existing plus 18 new auth scenarios), including actual cookies, trimmed/mixed-case login, enrollment/failure/recovery, concurrent invitation acceptance, owner races, tenant-local deactivation, reset/verification replay/expiry, generic delivery failure, session revocation and store/device/POS isolation/fixed expiry. API/DB/shared lint, API typecheck/build and shared build passed. Standalone guarded browser harness **3 Node checks passed**, covering production/secret refusal and an actual loopback server with real-cookie MFA, captured reset link and fixture cleanup. Root diagnosed/fixed an existing FEAT-031 precision bug (`timestamptz(3)` recovery timestamp rounding beyond `now()`) and made fairness testing deterministic; its 14 work-engine integration checks passed after the fix and in the full regression.

**Standalone browser harness:** build DB/shared/API first, then `pnpm --filter api auth:test:serve`. It loads `.env.test`; callers MUST provide `NODE_ENV=test`, `DB_TARGET=test`, `NEON_BRANCH_ID`, **`NEON_MAIN_BRANCH_ID`**, `DATABASE_URL` and a random `IMS_AUTH_TEST_SECRET` of at least 32 characters. Set `PORT`, `WEB_ORIGIN` and `BETTER_AUTH_URL` to actual browser-test host/ports; the server binds only `127.0.0.1` and checks the connected branch before listening. Normal `dist/main.js` has no fixture/capture endpoints. All harness endpoints below require `x-auth-test-secret` and belong only in test helpers, never product flows:

| Test-only method/path | Result / use |
|---|---|
| POST `/__auth-test/fixture` `{}` | `{fixtureId,tenants:[{id,name,slug,location}],owner,admin,member,unverified}`; each identity `{id,email,password,name}` has a fictional unique email/random password. Owner/member belong to both created tenants; admin/unverified to the first; unverified email flag is false. |
| GET `/__auth-test/mail?email=...&kind=verification|reset|invitation` | Latest captured `{email,kind,url}` or 404; the links use the configured actual API/web origins |
| POST `/__auth-test/totp` `{uri}` | `{code}` derived locally from a real setup URI; only current fictional fixture identity labels are accepted |
| POST `/__auth-test/reset-limits` `{}` | Clears disposable test-branch rate-limit counters between browser scenarios |
| POST `/__auth-test/cleanup` `{fixtureId}` | Removes fixture tenants/owned rows/identities and fixture mail captures; idempotent |

Clean fixtures explicitly in test teardown before terminating the child process (Windows termination may skip signal handlers). Graceful shutdown also cleans remaining tracked fixtures. Avoid concurrent unrelated fixture reset-limit operations while testing rate limits. `pnpm --filter api auth:test:harness` runs the three standalone safety/live checks. Browser session cookies and the harness secret are transient and must not be committed or printed.

**Limitations/next layer:** SMTP provider account/sender and deployment secrets are operator configuration; production/development migration rollout was not performed. Mail provider send failure intentionally remains enumeration-safe with generic reset/resend responses; UI should offer retry if mail does not arrive. Socket-based limits conservatively group traffic behind a proxy until a reviewed trusted-proxy policy exists. Public tenant signup, ownership transfer, granular roles/location assignments, cash shift/sales operations, PIN/offline auth and an audit viewer remain outside scope. Future POS APIs must validate the same named POS context before using its bound store. Frontend removal of the old development tenant switcher and actual-browser QA belong to Shamim/Tanvir and are not claimed complete here.

**BUG-012 follow-up, 2026-10-13:** replaced serialized-JSON escape scanning in the raw auth hook with iterative inspection of actual string values. Literal backslash-u0000 password text stays unchanged and valid; actual NUL remains rejected, including nested inputs. Five detector regression tests also cover deep/cyclic input without recursive stack overflow. A targeted real-cookie reset/sign-in case confirms actual-NUL reset rejection does not consume the reset token or revoke the old session, a literal backslash-u0000 password resets and signs in successfully, and actual-NUL sign-in remains 400. Verification: three affected auth unit files **25 passed**; targeted guarded test-branch integration **1 passed / 17 skipped**; API lint/typecheck/build passed. No endpoint/dependency changes or additional migrations. Independent Tanvir retest remains required before feature closure.

## Frontend handoff (Shamim)

Implemented by Codex acting as Shamim, 2026-10-13. All five frontend sub-features are delivered; handed to Tanvir for the complete independent regression suite and feature QA.

**Built:** Better Auth 1.7.7 React client with `twoFactorClient` and credentialed requests to the existing `/api/auth`; custom access calls import DTOs from `@ims/shared`. Added sign-in/out, verification resend/callback, reset request/completion, invitation information/registration/acceptance, authorized business selection, team invitations/revocation/deactivation, own session revocation, authenticator setup/challenge/recovery/code replacement/disabling, store-browser enrollment/approval/revocation and named register context. Routes are `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/verified`, `/invitation` plus `/auth/invitation` mail alias, `/businesses`, `/mfa`, `/access/members`, `/access/sessions`, `/access/devices` and `/register`.

**Session and permission boundary:** `AuthProvider` queries real `/access/me`, refreshes on focus/30-second authorization checks and immediately after session, tenant-context, membership, suspension or MFA failures. `SessionBoundary` protects organization/integration/access/register layouts and remounts prior business state by user/tenant. Identity and selected business are visible; explicit same-origin full navigation after identity changes clears client caches. Removed the development switcher/header from all normal flows; forged old localStorage values are ignored. Members have read-only organization views and no administrative controls; MFA-verified current membership controls administrative UI, with the API remaining authoritative. No customer auth token is persisted in browser storage.

**Security and UI detail:** reusable token-based panels/forms, focused safe error feedback, labels, loading/empty/denied states and mobile keyboard support. Passwords remain untrimmed. Reset success survives removal of its token URL. Authenticator QR is generated locally with pinned `react-qr-code` 2.2.0; setup key/recovery codes live only in component memory and are cleared on completion/navigation. Register enrollment discovers active stores across all cursor pages, displays the bound store and fixed deadline, and clears displayed POS access with an explanatory error when polling fails. Browser possession never substitutes for named sign-in; checkout/shifts/PIN/offline/public business signup remain outside scope.

**Verification:** web lint, typecheck and production build passed. `apps/web/e2e/authentication.spec.ts` **8/8 actual-cookie Chromium scenarios passed in 2.3 minutes** on the guarded actual Neon test branch. They cover member login/logout and tenant isolation, privileged MFA enrollment/fresh recovery/replay/rotation/disable, real verification/reset mail and old-cookie invalidation, invited registration/matching acceptance/mismatch/replay/revocation, tenant-local deactivation and immediate UI context refresh/last-owner protection, own session revocation, store browser approval/fixed named POS deadline/immediate revocation, and mobile keyboard/invalid-link/same-origin redirect behavior. No auth endpoint is mocked in this spec. Screenshot/trace capture is disabled while fixture setup secrets are displayed. Owned fixture ledger audit checked 24 fixtures across verification attempts: **zero owned tenants and zero owned users remained**. The owned web server and auth harness on 3100/3111 were stopped; the unrelated developer server on 3001 was preserved.

**QA notes:** existing fake/API organization and integration specs now select a server-authenticated business rather than the development picker. `helpers/legacy-auth-fixture.ts` creates guarded fictional MFA owners for the two seeded demo businesses and cleans only its own identities; standalone test-header backend isolation assertions remain independent fixtures. `helpers/auth-harness.ts` supplies random fictional identities and in-memory email links, records only owned IDs for cleanup auditing, skips the real auth suite when no database is configured, and fails configured unsafe targets before serving. Use `NEXT_PUBLIC_API_URL=http://localhost:3111` with web port 3100, explicit `NEON_MAIN_BRANCH_ID`, and exclusive rate-limit/database ownership. Details: `apps/web/e2e/AUTHENTICATION.md`. Root assigned the full old/new browser glob, Tanvir's four independent UI regressions and full API integration to Tanvir next; those complete regression results are intentionally pending QA, not claimed by this frontend handoff. BUG-012 also remains assigned for independent retest.

## QA report (Tanvir)

Independent QA complete, Codex acting as Tanvir, 2026-10-13. Database work ran serially only against the guarded actual Neon test branch; dedicated API 3111/web 3100 were released afterward and the unrelated developer API on 3001 was preserved.

| Check | Result |
|---|---|
| `pnpm --filter api test` | 408 passed in 27 files; V8 statement coverage 59.33% |
| `pnpm --filter @ims/db test` | 16 passed in two files |
| `pnpm --filter api test:integration` | 188 passed in 11 files, 240.05 seconds; actual branch identity guard enabled |
| `NEXT_PUBLIC_API_URL=http://localhost:3111 E2E_PORT=3100 pnpm --filter web test:e2e` | Entire 86-test/11-file glob executed: 85 passed in 6.9 minutes; one legacy selector defect (BUG-014) corrected and independently retested below; zero skipped |
| `pnpm --filter web test:e2e -- organization.spec.ts --grep 'API down shows an error state with retry'` | Corrected BUG-014 scenario passed, 15.7 seconds including fresh production build; all 86 scenarios now have passing evidence |
| API, DB, shared and web lint/typecheck | Pass; final web checks include corrected fixtures and all four independent QA tests |
| DB/shared/API builds and fresh production web builds | Pass |
| Independent QA test formatting | Pass |
| Guarded owned-fixture cleanup audit | 40 ledger fixtures: zero owned tenants, users, sessions, accounts, memberships, devices or POS grants remaining |

Eight auth browser scenarios use real cookies and captured test email, without mocked auth endpoints. Existing organization and loopback integration browser regressions also pass using guarded fictional MFA owners. Added `e2e/qa/authentication-ui-qa.spec.ts`: four independent mocked UI regressions verify reset success after removing the sensitive token URL, a store beyond the first 100 active locations, automatic POS polling clearing a revoked visible grant without a manual refresh, and immediate removal of the old tenant view after a 401 tenant-context failure. Setup secrets are excluded from screenshot/trace capture.

| AC | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Real cookie sign-in/out, expired/revoked-session API checks, own-session browser revocation and protected-route redirect |
| AC-2 | PASS | Current memberships, forged tenant/organization rejection, suspension checks, browser switching and legacy cross-tenant regressions |
| AC-3 | PASS | Real captured verification/reset mail, one-use/expiry/replay, generic responses, rate limits, old-cookie invalidation and token-free success UI |
| AC-4 | PASS | Invitation-only identity creation, matching verified email, raw signup/org/role bypass rejection, concurrent acceptance and revoked/expired/mismatched tokens |
| AC-5 | PASS | Last-owner concurrency invariant, immediate tenant-local deactivation enforcement, remaining tenant access and immediate stale-domain-view removal |
| AC-6 | PASS | Mandatory completed MFA per privileged session, enrollment/failure/fresh challenge, one-use recovery replay, code rotation and disabling/renewed enrollment |
| AC-7 | PASS | Same-tenant active store/browser approval, named fixed 12-hour grant, expiry/revocation/member/location rejection and automatic visible-grant removal |
| AC-8 | PASS | Labels, keyboard/mobile, loading/error/denied/expired states, named identity/business, removal of dev switcher and legacy authenticated screens |
| AC-9 | PASS | Test-only migration preserves tenant IDs/mapping; 408 API unit, 16 DB unit, 188 guarded integration and all 86 browser scenarios verified; cleanup audit clean |

**Bugs found / retested:** BUG-012 independently verified in unit and real-cookie integration checks: actual NUL reset/sign-in is rejected without consuming the reset token or revoking the old session, while an unchanged literal backslash-u0000 password resets and signs in successfully; Minhaj closed it. BUG-013 was reproduced as credentialed mock-fetch CORS failure, fixed by Shamim only in test fixtures and verified across the complete browser regression. BUG-014 was reproduced as the intended network alert plus Next's empty announcer matching a broad selector; Shamim scoped the selector and the isolated retest passes. No unresolved application defects or requirement gaps found; both fixture defects are Verified pending Minhaj closure.

Reviewed CI wiring for guarded ephemeral test-branch migration/integration/real-cookie browsers, explicit production-branch guard, secret-free browser skips and cleanup. The actual GitHub workflow remains unexecuted until a remote/secrets are configured. Production/development migration rollout, SMTP sender provisioning and Linux signal verification remain the previously recorded operational follow-ups; coverage of critical auth invariants is supplemented by real-database checks. No additional app or dependency changes were made by QA.

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
| BUG-012 | Literal backslash-u0000 password text mistaken for actual NUL | Backend | Codex (Rabbi role) | Fixed actual string-value inspection; independent Tanvir retest passed in all 408 API unit tests and all 188 guarded integration tests, including literal password reset/sign-in, actual-NUL rejection and preservation of unused reset tokens and old sessions | Closed |
| BUG-013 | Browser mocks reject credentialed auth requests through wildcard CORS | Frontend tests | Codex (Shamim role) | Shared test-only MOCK_CORS uses the exact trusted web origin and credentials with explicit headers/methods. Tanvir independently verified all mocked organization/integration/smoke/token scenarios and four new UI regressions in the full 86-case browser run; no remaining CORS failures. No application or DB changes. | Closed |
| BUG-014 | Legacy browser error selector also matches Next route announcer | Frontend tests | Codex (Shamim role) | Scoped the network alert by expected text, excluding Next's empty live announcer. Independent targeted Chromium retest passes (one case, 15.7 seconds including fresh production build). No application, fixture-contract or DB changes. | Closed |

Root's follow-up review identified BUG-012 after backend handoff. The approved password policy rejects actual NUL but permits ordinary literal escape text. Assigned to Rabbi for a routine validation repair; endpoint contracts are unchanged and Shamim continues the assigned frontend work. Independent feature QA must verify the regression before closure.

## Closure (Minhaj)

Closed 2026-10-13 after independent Tanvir verification of all nine acceptance criteria. All five sub-features are Done and BUG-012, BUG-013 and BUG-014 are Closed. Final evidence: 408 API unit, 16 DB unit and 188 guarded integration tests passed; all 86 browser scenarios verified (85 passes in the full run plus the corrected selector passing its targeted retest, zero skipped). Lint, types, builds and formatting pass. The guarded audit of 40 owned fixture entries found no remaining tenant/user/session/account/member/device/grant rows; owned test servers were stopped. Historical handoff notes above describe earlier pending work; this closure records the final state. Production/development schema rollout, SMTP configuration and the first GitHub CI run remain operational follow-ups rather than work performed here.
