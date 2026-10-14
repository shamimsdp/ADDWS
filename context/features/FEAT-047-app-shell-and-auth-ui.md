# FEAT-047: Application shell and auth UI

Status: Frontend - Shamim (requirements approved 2026-10-14; not started)

## Requirement review (Minhaj)

**Sub-features:** FEAT-047.1 Auth pages layout and styling, FEAT-047.2 App shell, FEAT-047.3 Dashboard home, FEAT-047.4 Shared page primitives and states, FEAT-047.5 Re-skin existing pages into the shell

**Origin:** requested directly by the project owner (user) 2026-10-14. In-scope owner feature, not an external client CR (no Nadia flow). Problem: no designed auth pages, sidebar, header, footer or main content area; the owner wants a clean, beautiful light/white UI like the local agent dashboard (`tools/agent-dashboard`: left sidebar, top bar, card panels, soft borders, generous spacing, polished status chips).

**Dependencies done:** FEAT-002 Done (session, MFA, invitation, device sign-in). FEAT-003.1-.4 BE/FE Done (permissions are in the session; QA browser regression still In progress, see the FEAT-003 file; navigation gating only reads the session `permissions`, already merged).

**Sources checked:** `ui-rules.md`, `ui-tokens.md`, `ui-registry.md`, `code-standards.md`, `architecture.md`, `feature-list.md`; existing web code (`apps/web/src/app/layout.tsx`, `components/auth/*`, `components/organization/*`, `components/ui/*`, `components/tenant-*`, `skip-link.tsx`, `i18n/*`, `e2e/qa/tokens.spec.ts`); FEAT-042 file (locale/Bangla plan); `tools/agent-dashboard/public` as visual reference only.

**Gap checklist:**
- [x] User roles and permissions: nav items shown by session permissions; hiding is UX only, the API still enforces.
- [x] Business rules and policies: none new.
- [x] Data fields, validation, uniqueness: none (no new data).
- [x] States and transitions: sidebar collapsed/expanded, mobile drawer open/closed, session loading/unauthenticated/authenticated.
- [x] Failure, edge and concurrency cases: API down, expired session, no tenant, no permissions, very long tenant/user names, Bangla-length text.
- [x] Tenant and location scope: tenant name always visible in header (ui-rules); location area reserved.
- [x] Money / tax / timezone: none.
- [x] Audit needs: none.
- [x] UI screens and flows: see gaps below.
- [x] Integrations: only the existing health endpoint for system status.
- [x] Open decisions (D-xx): none apply.

**Gaps found:**

| # | Gap | Type | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| G1 | Visual direction | Routine (design) | Light theme using the existing `ui-tokens.md` semantic tokens via Tailwind theme names (canvas, surface, ink, line, action, semantic). Take layout and polish from the agent dashboard, not its colours. No dark mode (undecided). New tokens only as semantic theme names mirrored in `ui-tokens.md`, never raw hex in components (`e2e/qa/tokens.spec.ts`) | as proposed | Minhaj |
| G2 | Brand / logo | Routine | Text wordmark from `t('app.name')` plus a simple token-coloured SVG mark; no external assets. Approved brand identity stays open (ui-tokens is proposed) | as proposed | Minhaj |
| G3 | Navigation structure | Routine | Groups: Overview (Dashboard); Organization (Business, Brands, Locations, Settings; permissions `tenant.read`, `brand.read`, `location.read`, `settings.manage`); Access (Members `member.read`, Devices `register.manage`, Sessions for any signed-in user); Integrations (`integration.read`). Only built routes appear, no dead "coming soon" links. One config-driven nav registry (permission, label key, icon, href) so later features add one entry. A group with no visible item is hidden | as proposed | Minhaj |
| G4 | Route protection | Routine | Client-side: shell redirects unauthenticated users to `/sign-in?next=<path>` (same-origin relative path only, validated against open redirect) instead of raw error screens; authenticated users without permission see a permission-denied state. UX layer only; the API remains the enforcement. No Next middleware and no backend change. Decision: no Deep trigger, no BE layer | as proposed | Minhaj |
| G5 | Shell vs auth route groups | Routine | Next route groups: `(auth)` (sign-in, register, forgot/reset password, verify-email, mfa, invitation, `auth/*`, businesses) renders the centred-card layout without sidebar; `(app)` renders the shell. URLs unchanged so existing Playwright specs keep working | as proposed | Minhaj |
| G6 | Header contents | Routine | Mobile menu button, tenant name (existing `TenantBadge`), a location area (read-only active-location text/placeholder; no switching behaviour invented, the warn-before-change rule from ui-rules applies when later features add it), user menu (identity, My sessions, sign out). No global search or notifications yet (FEAT-040.3) | as proposed | Minhaj |
| G7 | Sidebar behaviour | Routine | Desktop >= 1024 px: expanded 256 px, collapsible to a 72 px icon rail, choice persisted in localStorage (no personal data). Below 1024 px: off-canvas drawer with overlay, focus trap, Esc to close, closes on navigation. Active item uses `aria-current="page"` plus a visual indicator (not colour alone) | as proposed | Minhaj |
| G8 | Footer | Routine | Slim footer: app name and version; no marketing links | as proposed | Minhaj |
| G9 | Dashboard home content | Routine | Welcome with user name and tenant; setup checklist from real existing data only (business profile, at least one location, invite a teammate, connect an integration; each links to its page, done/todo from existing list endpoints, soft "unknown" when a call fails); permission-gated quick actions; system status card reusing the API health check with a status chip. No invented sales/stock metrics (FEAT-039.7) | as proposed | Minhaj |
| G10 | Bangla | Routine | Every new string through `t()` with keys in English catalog files (one new catalog file per area to avoid conflicts). Bangla catalog, locale switcher and font loading are FEAT-042.1 deliverables. FEAT-047 must not hard-code text, must avoid fixed-width labels and must survive 30-40% longer strings (wrap, no truncation of essential labels). Bangla rendering is verified once FEAT-042.1 lands | as proposed | Minhaj |
| G11 | Status chips | Routine | Shared `StatusChip` (success/warning/danger/info/neutral) with icon + text, token colours, reused by dashboard and re-skinned pages | as proposed | Minhaj |
| G12 | Existing e2e specs | Routine | URLs and `data-testid` values used by `authentication`, `organization`, `integrations` specs must keep working; update specs only where DOM structure genuinely changed and list each change in the handoff | as proposed | Minhaj |
| G13 | Shared fixtures vs FEAT-003 | Routine | FEAT-003 browser regression is incomplete and its fixture edits (`apps/web/e2e/helpers/fake-api.ts`) are uncommitted; Shamim reuses the fake API permissions and keeps commits separate from those fixture edits | as proposed | Minhaj |

No business-policy gap remains.

**Estimates (fully-agentic, agent hours, .1 to .5):** PM 1 / 0.5 / 0.25 / 0.5 / 0.25; FE 4 / 8 / 3 / 6 / 6; QA 1.5 / 3 / 1 / 2 / 2.5. BE N/A. Recorded in `feature-progress-list.md`.

**Requirements approved:** yes (decided by user's directive, fully-agentic, 2026-10-14)

## Assignment (Minhaj)

**Execution lane:** Standard

**Why this lane / final verifier:** FE-only, no migration, no API or contract change, no change to authentication or permission enforcement (client-side redirect and nav gating are UX; the API still authorises). Shamim builds; one independent Tanvir pass after freeze runs the whole web Playwright suite once because the layout touches every page. Escalate to Deep only if Shamim finds a new or changed API/session field is needed; then stop and report.

**User outcome:** Signed-out users land on a polished, cohesive auth screen; signed-in users get a clean light application with sidebar, header, content area and footer, a useful home page and consistent pages, usable by keyboard and on mobile.

**In scope:** Sub-features 047.1-047.5 per `feature-list.md` and gaps G1-G13.

**Out of scope:** dark mode; Bangla catalog, locale switcher and fonts (FEAT-042.1); real dashboard metrics (FEAT-039.7); global search; notifications; location switching behaviour; new backend endpoints; new business modules; brand identity/logo design.

**Acceptance criteria:**
- AC-1: All auth routes (`/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/mfa`, `/invitation`, `/auth/*`, `/businesses`) share one centred-card layout with a brand panel (hidden or stacked on small screens) and consistent field, error and success styling; URLs and existing behaviour unchanged.
- AC-2: All other routes render inside the app shell with landmarks `header`, labelled `nav`, one `main`, `footer`; the skip link moves focus to `main`; one `h1` per page.
- AC-3: Sidebar shows grouped navigation from a single config; items appear only when the session holds the permission; active item has `aria-current="page"` and a non-colour indicator; a group with no visible items is hidden. Verified with an owner, a limited (cashier-like) and a no-permission session.
- AC-4: Sidebar collapses to an icon rail on desktop (state persisted, accessible names kept); below 1024 px it is an off-canvas drawer with overlay, focus trap, Esc to close, focus returned to the trigger, closing on navigation.
- AC-5: Header always shows the tenant name, has a location area (no invented behaviour) and a user menu (identity, My sessions, sign out) operable by keyboard (Enter/Space/Esc/arrows, `aria-expanded`, `aria-haspopup`).
- AC-6: Unauthenticated access to any app route redirects to `/sign-in?next=...` with a validated relative `next`, and the user returns there after sign-in. Authenticated users without permission see a permission-denied state. API-down shows an error state with retry, not the Next error screen.
- AC-7: Dashboard home shows welcome, a setup checklist from real data with soft failure, permission-gated quick actions and a system status card with a chip (icon + text); no fabricated metrics.
- AC-8: Shared primitives exist and are used by the re-skinned pages: PageHeader, Card, DataTable (responsive overflow), StatusChip, EmptyState, LoadingState (skeleton), ErrorState (retry), PermissionDenied. Registered in `ui-registry.md` (components and screens).
- AC-9: `/organization/*`, `/access/*` and `/integrations` use the shell and primitives with no loss of behaviour; existing Playwright specs pass (selector changes documented).
- AC-10: Accessibility: visible focus ring on every interactive element, tab order follows visual order, contrast checked for each token pair used (text >= 4.5:1, UI >= 3:1), status never by colour alone, touch targets >= 40 px (>= 44 px for drawer and menu controls), `prefers-reduced-motion` respected, no keyboard traps outside the open drawer/menu.
- AC-11: Responsive: usable at 360, 768, 1024 and 1440 px with no horizontal page scroll (tables scroll inside their container).
- AC-12: Token compliance: no raw hex/rgb or arbitrary pixel values in components; new colours/sizes are semantic theme names mirrored in `ui-tokens.md`; `e2e/qa/tokens.spec.ts` stays green.
- AC-13: All user-visible strings go through `t()` with keys in English catalogs; layouts tolerate longer (Bangla-length) text; `lang` stays driven by `DEFAULT_LOCALE`.
- AC-14: Playwright specs cover AC-1 to AC-8, AC-10 (keyboard-only navigation, drawer focus trap, user menu) and AC-11 (viewport checks); web lint, typecheck, build and targeted e2e pass.

**Frontend tasks (Shamim):** Build in this order and commit per sub-feature: 047.4 primitives and `StatusChip` first (others use them), then 047.1 auth layout (`(auth)` route group), 047.2 shell (`(app)` group, nav registry, sidebar, header, footer, drawer, redirect and permission-denied), 047.3 dashboard home, 047.5 re-skin. Keep URLs and `data-testid`s stable; update `ui-registry.md` and `ui-tokens.md` in the same work. Use the agent dashboard (`pnpm agents:dashboard`, http://127.0.0.1:4310) as visual reference only. Run lint/typecheck/build and targeted Playwright for changed areas, not the full suite (Tanvir does). Set FE to `Done` per sub-feature when verified (fully-agentic mode has no Review state).

**QA focus (Tanvir):** After freeze, one full web Playwright run; keyboard and focus walk-through; 360/768/1024/1440 px screenshots; permission-gated nav with three role fixtures; redirect `next` open-redirect attempts (`//evil.com`, `https://evil.com`, `javascript:`); API-down state; existing-spec regression; token-compliance spec; long-text overflow check. Record the FEAT-003 port-3001 issue if real-API specs cannot start.

## Backend handoff (Rabbi)

Not applicable (FE-only).

## Frontend handoff (Shamim)

**Built:**

**Playwright:** spec path / command / result

**Notes for QA:**

## QA report (Tanvir)

**Commands run / results:**

| AC | Result | Notes |
|---|---|---|

**Bugs found:**

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
