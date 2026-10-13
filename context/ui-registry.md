# UI registry

Status: planned screens/components, plus the base skeleton components listed under Implemented components.

## Screens

| Screen | Main purpose | Status |
|---|---|---|
| Authentication | Invitation-only sign-in, verification, reset and authorized business selection | Implemented FEAT-002; `/sign-in`, `/invitation`, `/businesses` and mail routes |
| Account security | Authenticator enrollment/challenge/recovery and own-session revocation | Implemented FEAT-002; `/mfa`, `/access/sessions` |
| Team access | Staff invitations, revocation and tenant-local deactivation | Implemented FEAT-002; `/access/members` |
| Register access | Store browser enrollment/approval/revocation and named fixed-deadline session | Implemented FEAT-002; `/access/devices`, `/register` |
| Tenant onboarding/settings | Business, tax, locations, import and plan setup | Planned |
| Dashboard | Sales, stock risk, exceptions and actionable summaries | Planned |
| Apparel catalog | Styles, collections, color/size matrix and labels | Planned |
| Inventory | Location balances, status buckets and movement history | Planned |
| Purchasing/receiving | Supplier, PO, partial receipt and inspection | Planned |
| Transfers | Request, dispatch, in-transit, receipt and discrepancy | Planned |
| Counts/adjustments | Blind count, variance, approvals and posting | Planned |
| POS/shifts | Scanner checkout, tenders, receipt and cash reconciliation | Planned |
| Returns/exchanges | Original sale, inspection, replacement and settlement | Planned |
| Online order desk | Automated intake, mapping, reservation and fulfillment | Planned |
| Shipping/COD | Booking, tracking, physical returns and settlements | Planned |
| Customers | Contact details, history and consent | Planned |
| Reports | Sales, variant performance, aging, stock cover and margin | Planned |
| Integration health | Sync lag, mapping errors, retries and reconciliation | Planned |
| Integration connections | Provider connections, credential replacement, testing and enable/disable | Implemented FEAT-031.6; `/integrations` |
| Access/audit | Roles, locations, devices and sensitive action history | Planned |

## Shared components

App shell; tenant/location selector; variant matrix; barcode input; money/quantity display; stock status summary; data table; filters; document status; approval/reason dialog; import preview; receipt; offline/sync indicator; permission-aware action; exception/retry panel.

Add component names, implementation paths, owners and verified states as components are built. Review for reuse before creating another component with the same purpose.

## Implemented components

| Component | Path | Owner | Purpose | Verified states |
|---|---|---|---|---|
| App shell (root layout) | `apps/web/src/app/layout.tsx` | Shamim | Skip link, banner, primary nav landmark, main, footer; light theme | Landmarks and focus order (e2e AC-11) |
| SkipLink | `apps/web/src/components/skip-link.tsx` | Shamim | First focusable link to `#main-content` | Hidden until focused, visible on focus, keyboard activation |
| ApiHealthStatus | `apps/web/src/components/api-health-status.tsx` | Shamim | API liveness via the typed client; retry; shows correlation ID on API errors | Loading, ok, network error, API error body (e2e) |
| Typed API client | `apps/web/src/lib/api/client.ts` | Shamim | `apiFetch<T>`, `ApiError` (R6 body), `NetworkError`; types from `@ims/shared` | Used by ApiHealthStatus |
| i18n `t()` | `apps/web/src/i18n/` | Shamim | Typed message keys, English catalog, `{param}` interpolation | English only |
| Organization area | `apps/web/src/app/organization/` (layout + business, brands, locations, settings pages) | Shamim | FEAT-001 screens: tabs, tenant gate, forms and lists | Loading, empty, error, 401/403/404, validation, 409, 422, conflict (e2e) |
| TenantProvider / TenantBadge | `apps/web/src/components/tenant-provider.tsx`, `tenant-badge.tsx` | Shamim | Loads the current organization once; name shown in the header | Loading, ok, no context |
| DevTenantSwitcher (retired) | `apps/web/src/components/dev-tenant-switcher.tsx` (+ `lib/dev-tenant.ts`) | Shamim | Removed from application flows in FEAT-002; no authenticated request uses its header or localStorage | Session business selector supersedes it |
| OrgTabs, RequireTenant | `apps/web/src/components/organization/` | Shamim | Section links with `aria-current`; explicit state when there is no tenant context | e2e |
| BrandsTab, LocationsTab, SettingsTab, BusinessTab | `apps/web/src/components/organization/` | Shamim | List + inline form + confirm patterns; reuse for later master-data screens | e2e |
| ListToolbar, usePagedList | `components/organization/list-toolbar.tsx`, `lib/use-paged-list.ts` | Shamim | Debounced search, status filter, new button, cursor paging with load more | e2e |
| AddressFields | `apps/web/src/components/organization/address-fields.tsx` | Shamim | Address inputs with `address.*` server errors | e2e |
| Button, TextField, SelectField, StatusBadge, Notice | `apps/web/src/components/ui/form.tsx` | Shamim | Form primitives with label/hint/error wiring | e2e |
| LoadingState, EmptyState, ErrorState | `apps/web/src/components/ui/states.tsx` | Shamim | Explicit page states; ErrorState maps ApiError codes | e2e |
| ConfirmDialog | `apps/web/src/components/ui/confirm-dialog.tsx` | Shamim | Native modal confirm (focus trap, Escape, busy and error text) | e2e |
| FormFeedback, useSubmit | `components/ui/form-feedback.tsx`, `lib/use-submit.ts` | Shamim | Focused error summary, success message, busy state | e2e |
| IntegrationsPage | `apps/web/src/components/integrations/integrations-page.tsx` | Shamim / Codex | Connection list, status filter, cursor paging, test results and enable/disable confirmations | Loading, empty, errors/retry, permission denied, key unavailable, test pending/pass/fail |
| CreateConnectionForm / EditConnectionPanel | `apps/web/src/components/integrations/create-connection-form.tsx`, `edit-connection-panel.tsx` | Shamim / Codex | Provider registry and optional brand selection; create, edit and replace credentials | Provider loading/error/empty, required/server validation, existing inactive brand preserved |
| CredentialFields | `apps/web/src/components/integrations/credential-fields.tsx` | Shamim / Codex | Schema-driven password inputs; write-only values cleared after save/cancel | Accessible labels, required/optional fields, password autocomplete, validation |
| WebhookSecretReveal | `apps/web/src/components/integrations/webhook-secret-reveal.tsx` | Shamim / Codex | One-time webhook secret and public URL; clipboard copy with manual fallback | Shown once at creation, dismissal/reload clears secret, clipboard status |
| AuthProvider / SessionBoundary / Identity | `apps/web/src/components/auth/auth-provider.tsx` | Shamim / Codex | Real verified cookie identity, protected layouts, business/session MFA boundary, refresh after authorization failures, identity and sign-out | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
| AuthPanel / AuthFeedback / useAuthAction | `apps/web/src/components/auth/auth-primitives.tsx` | Shamim / Codex | Shared authentication panel, focused safe error/success feedback, submission loading, same-origin fresh-session navigation | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
| SignInPage / MailRequestPage / ResetPage / VerifiedPage / InvitationPage / BusinessesPage | `apps/web/src/components/auth/entry-pages.tsx` | Shamim / Codex | Invitation-based verified email/password entry, verification/reset and authorized business selection | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
| MfaPage | `apps/web/src/components/auth/mfa-page.tsx` | Shamim / Codex | Local authenticator QR/key, enrollment challenge, one-use recovery, code replacement and disabling with re-enrollment warning | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
| MembersPage / SessionsPage / DevicesPage / RegisterPage | `apps/web/src/components/auth/access-pages.tsx` | Shamim / Codex | Team invitations/deactivation, own session revocation, store-bound browser approval and named fixed-deadline register access | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
| AdminOnly / useCanManageBusiness | `apps/web/src/components/auth/auth-provider.tsx` | Shamim / Codex | Hide business mutation controls unless current membership and session permit administration; API remains authority | Independent FEAT-002 QA passed: real-cookie flows, authorization/revocation, keyboard/mobile and full browser regression |
