# FEAT-001: Tenancy and organization

Status: Done (2026-10-12)

## Requirement review (Minhaj)

**Sub-features:** FEAT-001.1 Tenant model and isolation, FEAT-001.2 Legal entity, FEAT-001.3 Brands, FEAT-001.4 Locations, FEAT-001.5 Tenant settings

**Dependencies done:** FEAT-000 Project setup (Depends on: FEAT-000) is Done (closed 2026-10-12, QA passed all 15 ACs). Not yet available and not required: FEAT-002 authentication, FEAT-003 roles/permissions, FEAT-004 audit, FEAT-043 signup. See gaps R2 and R3 for how FEAT-001 works without them.

**Sources checked:**
- `context/feature-list.md` (FEAT-001 notes; FEAT-002, 003, 004, 005, 043, 044, 117 for what is deliberately NOT here), `feature-progress-list.md`, `feature-queue.md` (FEAT-001 ranked #1, unlocks 40, no blocked sub-features)
- `context/architecture.md` (Tenant -> legal entity -> brands and locations; one legal entity per tenant initially; tenant ownership validated on every referenced entity; location scope; document identity; UTC instants plus business timezone)
- `context/code-standards.md` (tenant-scoped uniqueness; stable opaque IDs separate from human document numbers; centralised rounding policy; UTC plus business timezone; exact decimal money)
- `context/project-rules.md` (rule 4 tenant isolation and location permissions everywhere; rule 7 effective-dated tax; rule 13 no secrets/customer data)
- `context/project-overview.md` (multi-tenant SaaS for clothing brands; Bangladesh-first), `context/roadmap.md`, `context/build-plan.md` stage 2, `context/workflow.md` (onboarding: tenant -> legal/tax settings -> locations/roles)
- `context/Library-docs.md`, `context/progress-tracker.md` (D-01 Better Auth; FEAT-000 closed; Neon branches), `.claude/agents/rabbi-backend-developer.md` (the Better Auth organization mapping is to be decided in the FEAT-002 review; a Nest guard attaches user, tenant and role context)
- `context/ui-rules.md` (tenant and active location visible; explicit loading/empty/error/permission states; no hard-coded text), `context/ui-tokens.md`, `context/ui-registry.md` (planned "Tenant onboarding/settings" screen)
- Research at repo root: `deep-research-report.md` (multi-tenant SaaS, BDT, Asia/Dhaka, tenant isolation, store scope), `compass_artifact_*.md` (multi-company is P3 with separate legal entities and BINs; tenant admin and onboarding MVP; role-based masking), `clothing_inventory_management_software_product_spec.md` (multi-currency listed as non-goal; location and tenant concepts). Discovery material only, not approved decisions.
- Code state: `packages/db/prisma/schema.prisma` has no models (empty baseline); `apps/api` has config, database, health, common modules; `apps/web` has base layout and i18n structure.

**Gap checklist:**
- [x] User roles and permissions: Real roles and guards are FEAT-003; users are FEAT-002. FEAT-001 only needs the tenant boundary. Interim rule (R3): mutating tenant/brand/location/settings endpoints require a resolved tenant context and are limited to an "owner/admin" capability flag supplied by the same interim context; the real permission check replaces it in FEAT-003. Platform-level tenant creation and suspension are FEAT-043/044, not here.
- [x] Business rules and policies: Questions Q1-Q4 (brand-location link, location types, document numbering, rounding). One legal entity per tenant (architecture). Never hard-delete: deactivate. Currency BDT only for now (R6).
- [x] Data fields, validation, uniqueness: Defined in R4 (tenant), R5 (legal entity, brand), R7 (location), R8 (settings). All tenant-owned uniqueness is tenant-scoped; every tenant-owned row carries `tenantId`; cross-entity references use composite (tenantId, id) so a row can never point into another tenant.
- [x] States and transitions: Tenant status `active` / `suspended` (suspension enforcement lands in FEAT-044; the field exists now). Brand, location: `active` <-> `inactive`. No other lifecycle. See R9.
- [x] Failure, edge and concurrency cases: Duplicate code/name under concurrent create (unique constraint is authority, mapped to 409); cross-tenant reference attempt (rejected, 404 not 403 to avoid leaking existence); deactivating the last active location or the only brand (allowed, warning only, no inventory exists yet; stock check added when inventory exists); optimistic concurrency on settings edits (`version` field, 409 on stale update); invalid timezone or currency code (400); inactive entity referenced by new documents (later features must refuse).
- [x] Tenant and location scope: This feature IS the tenant boundary (R1). Location-level user scoping is FEAT-003.3; FEAT-001 only provides the locations and a way to list them.
- [x] Money / tax / timezone rules: Currency stored as ISO 4217 code on tenant settings (BDT only enabled, R6); business timezone IANA name at tenant level with an optional location override (R8); instants UTC timestamptz; rounding policy Q4; tax configuration is FEAT-024 (D-05 open), only BIN/TIN as optional text here (R5).
- [x] Audit needs: FEAT-004 does not exist yet. FEAT-001 records `createdAt`, `updatedAt`, `createdBy`/`updatedBy` as nullable actor ids (filled once FEAT-002 exists) and logs every mutation with correlation ID; FEAT-004 will later attach before/after audit events to these operations (R10).
- [x] UI screens and flows: One "Organization" settings area (R11): business profile and legal entity, brands list + form, locations list + form, settings form. Tenant name always visible in the layout header. Active-location selector waits for FEAT-003.3. All states designed (loading, empty, error, permission denied, conflict).
- [x] Integrations: None. (Better Auth link is Q5 and FEAT-002; integration framework is FEAT-031.)
- [x] Open decisions (D-xx): None block FEAT-001. D-05 (tax) and D-04 (valuation) do not affect this feature's fields; Q3 and Q4 must stay compatible with whatever D-05 decides (noted in the answers).

**Gaps found:**

Routine, reversible, implementation-level (decided by Minhaj):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | How tenant isolation is enforced | Routine | Application-level scoping plus database constraints: every tenant-owned table has `tenantId` NOT NULL; unique constraints and foreign keys are composite with `tenantId` so cross-tenant references are impossible at the DB level; a tenant-scoped Prisma client extension/repository helper injects `tenantId` into every query and write and refuses calls without a tenant context; unscoped Prisma access is limited to platform code and flagged by lint. Postgres row-level security is NOT used now (pooled Neon connections make per-request session variables fragile); revisit as hardening under FEAT-045. A reusable cross-tenant test helper proves isolation for every later tenant table. | As proposed. Reason: strongest guarantee achievable without fragile pooling tricks; DB constraints give defence in depth; reversible (RLS can be layered on later). | Minhaj |
| R2 | Own tenant table vs Better Auth organization as the tenant | Routine (for FEAT-001) | `Tenant` is our own table with our own opaque ID and holds all domain data (legal entity, brands, locations, settings). Nothing in FEAT-001 depends on Better Auth. How users link to tenants (organization plugin membership vs own membership table) is decided in the FEAT-002 review, see Q5. | As proposed (Q5 asks the user to confirm direction). Reason: domain tenancy must not depend on an auth plugin's schema. | Minhaj |
| R3 | Tenant context before authentication exists | Routine | A `TenantContext` (AsyncLocalStorage, extending the existing request context) is resolved by a `TenantGuard`. Until FEAT-002, the only resolver is a dev/test-only `x-tenant-id` header, enabled solely when `NODE_ENV` is `development` or `test` and an explicit `ALLOW_DEV_TENANT_HEADER=true` is set; in any other environment the guard fails closed (401). FEAT-002 replaces the resolver with the Better Auth session. Interim "admin" capability is the same dev context. | As proposed. Reason: lets Rabbi, Shamim and Tanvir build and test FEAT-001 end to end without auth, with no path to production exposure. | Minhaj |
| R4 | Tenant fields | Routine | `id` (opaque, e.g. UUID v7/cuid), `slug` (unique, lower-case a-z0-9-, 3-40, immutable; for support/diagnostics, not used for URL routing yet), `name` (display, 2-120), `status` (`active`/`suspended`), `createdAt`, `updatedAt`. Tenant creation path in FEAT-001: internal service plus idempotent seed (dev/test only, guarded as in FEAT-000); public signup is FEAT-043; plan/limits are FEAT-044. No tenant create/delete HTTP endpoint is exposed in FEAT-001. Read: `GET /tenant` (current tenant) and `PATCH /tenant` (name only). | As proposed. Reason: keeps platform-level operations out of the tenant-facing API. | Minhaj |
| R5 | Legal entity and brand fields | Routine | LegalEntity (one per tenant, `unique(tenantId)`; unique is droppable for FEAT-117): `legalName` (required, 2-200), `tradingName` (optional), `bin` (optional text, trimmed, no format validation yet), `tin` (optional text), `registeredAddress` fields (line1, line2, city, district, postalCode, country default `BD`), `phone`, `email`. BIN/TIN format and tax applicability checks wait for D-05. Brand: `name` (required, 1-100, unique per tenant case-insensitively), `code` (required, 2-10 uppercase alphanumerics, unique per tenant, immutable), `status`. A tenant must have at least one brand when it goes live (enforced in FEAT-043 go-live, not here). | As proposed. Reason: collect identifiers now, validate when the tax rules are decided. | Minhaj |
| R6 | Currency | Routine | `currencyCode` stored on tenant settings as ISO 4217, default and only allowed value `BDT` now; set at tenant creation and not editable afterwards (changing currency under posted history would corrupt it); money is always Decimal. Multi-currency is out of scope (spec lists it as a non-goal). | As proposed. Reason: spec non-goal; immutability protects history; reversible later by an explicit feature. | Minhaj |
| R7 | Location fields and rules | Routine | `name` (1-100, unique per tenant case-insensitively), `code` (2-10 uppercase alphanumerics, unique per tenant, immutable; used later in document numbers and barcodes), `type` (`store` / `warehouse` / `online_fulfilment`, per Q2), address (as legal entity), `phone`, `timezone` (optional override, IANA name; blank = tenant default), `status`, `legalEntityId` (the tenant's entity; keeps FEAT-117 open). Deactivate only, never delete. Inventory-balance and open-document checks before deactivation are added by the inventory/POS features; FEAT-001 exposes the rule as a documented hook. Default sort: name ascending, active first. | As proposed. Reason: code immutability keeps references stable; hooks avoid guessing inventory rules now. | Minhaj |
| R8 | Tenant settings fields | Routine | `currencyCode` (R6), `businessTimezone` (IANA, default `Asia/Dhaka`, validated against the runtime tz database), `defaultLocale` (`en` or `bn`, default `en`; UI translation is FEAT-042), `documentNumbering` (Q3), `rounding` (Q4: scale 2, mode half away from zero i.e. commercial half-up, level per line, `cashRounding` false and reserved), `version` (optimistic concurrency). Business date of a document = instant converted in the location timezone (else tenant timezone), as in `code-standards.md`. Changing the business timezone is allowed but affects only future business dates; already-posted documents keep their stored business date (enforced when documents exist). | As proposed. Reason: matches code-standards; settings are versioned so concurrent admins do not overwrite each other. | Minhaj |
| R9 | Tenant status behaviour | Routine | `suspended` is recorded and visible in the API but enforcement (blocking sign-in and all tenant calls) is FEAT-044. In FEAT-001 the guard already returns 403 `TENANT_SUSPENDED` for a suspended tenant, because it is one line and prevents a gap. | As proposed. Reason: cheap fail-closed behaviour. | Minhaj |
| R10 | Audit and logging until FEAT-004 | Routine | Every mutation logs actor (nullable until FEAT-002), tenantId, entity, entityId, action and correlationId through the existing structured logger (no PII beyond ids). No separate audit table here. | As proposed. Reason: FEAT-004 owns audit; logs keep traceability meanwhile. | Minhaj |
| R11 | UI scope and shape | Routine | One "Organization" area with tabs: Business (tenant name + legal entity), Brands, Locations, Settings. Lists with search, status filter (active/inactive/all), empty states and inline create/edit forms; server validation errors rendered per field; keyboard friendly, labelled inputs; strings via the existing i18n structure; tenant name shown in the layout header. Registers new components in `ui-registry.md`. Active-location selector is deferred to FEAT-003.3. Screens only available with the interim dev tenant context until FEAT-002. | As proposed. Reason: matches planned screen in `ui-registry.md` and `ui-rules.md`. | Minhaj |
| R12 | API conventions | Routine | REST under `/tenant`, `/legal-entity`, `/brands`, `/locations`, `/tenant-settings`; list endpoints paginated (`limit` default 50, max 200, cursor) with a stable sort; PATCH for edits; DTO types in `@ims/shared`; errors in the R6 shape from FEAT-000; cross-tenant ids return 404. | As proposed. Reason: consistent with FEAT-000 conventions. | Minhaj |

Needed the user (answered 2026-10-12, all as recommended):

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| Q1 | Relationship between brands and locations | Business | Locations are tenant-level and not tied to a brand; every brand's styles can be stocked and sold at any location; brand lives on the style (FEAT-006) | Locations are tenant-wide and not tied to a brand; any brand's styles can be stocked and sold at any location. Brand lives on the style (FEAT-006). | User, 2026-10-12 |
| Q2 | Can one location be more than one type (store, warehouse, online fulfilment)? | Business | One type per location; a store back room or a shared warehouse is modelled as a separate warehouse location | Exactly one type per location (`store`, `warehouse`, `online_fulfilment`). A back room or an online-shipping warehouse is a separate location. | User, 2026-10-12 |
| Q3 | Document numbering scheme (prefix, year/fiscal-year reset, gaps) | Business | Per-tenant sequence per document type, format `PREFIX-YYYY-NNNNNN`, configurable prefix, reset each Bangladesh fiscal year (1 July) is an alternative, see question | Per-tenant sequence per document type, format `PREFIX-YYYY-NNNNNN`, configurable prefix, reset every calendar year by business date (Asia/Dhaka). Gap-free only where legally required (revisit with D-05). | User, 2026-10-12 |
| Q4 | Rounding policy (line vs document level, cash rounding) | Business | 2 decimals, half-up, rounded per line, taxes per tax rules in FEAT-024, no cash rounding by default but a per-tenant switch reserved | 2 decimals, half-up, rounded per line; tax rounding per FEAT-024; no cash rounding by default (per-tenant switch reserved for later). | User, 2026-10-12 |
| Q5 | Tenant to Better Auth link (own tenant table + organization plugin membership vs plugin-only) | Business / architecture | Own `Tenant` table; the Better Auth organization plugin (if used) maps 1:1 to it and carries only membership, invitations and roles; final mapping settled in the FEAT-002 review | Own `Tenant` table owns all domain data. In FEAT-002 the Better Auth organization plugin maps 1:1 to it and carries only membership, invitations and roles. | User, 2026-10-12 |

**Requirements approved:** yes (2026-10-12)  <!-- Rabbi may start -->

## Assignment (Minhaj)

**User outcome:** Every later feature has a safe tenant boundary to build on: a tenant with one legal entity, brands, locations (store / warehouse / online fulfilment) and settings (BDT, Asia/Dhaka, document numbering, rounding), with isolation between tenants enforced in the API and the database, and an Organization screen to manage it.

**Sub-features:** FEAT-001.1, FEAT-001.2, FEAT-001.3, FEAT-001.4, FEAT-001.5

**In scope:**
- Tenant model and isolation (R1-R4, R9, R10, R12): tenant-scoped Prisma helper, composite keys, `TenantContext` and `TenantGuard` with the dev-only header resolver, isolation test helper.
- Legal entity, brands, locations, tenant settings with the fields and rules in R5-R8 and answers Q1-Q5.
- Document number service (`PREFIX-YYYY-NNNNNN`, per tenant, per document type, calendar-year reset by business date) and money rounding helper (half away from zero at 2 decimals, Decimal only), both used by later features.
- Organization UI (R11) and guarded dev/test seed with two demo tenants.

**Out of scope:** authentication, users, roles, permissions and the active-location selector (FEAT-002/003); audit table (FEAT-004); tenant signup, setup wizard, go-live checks (FEAT-043); platform admin, plans, suspension enforcement UI (FEAT-044); tax configuration and BIN/TIN validation (FEAT-024, D-05); stock or open-document checks before deactivation (added by inventory/POS features); multi-currency; Postgres RLS; locale translations (FEAT-042); multiple legal entities (FEAT-117).

**Sequencing:** Rabbi first (schema, tenant context, API, services, tests), then Shamim (Organization UI and Playwright), then Tanvir.

**Acceptance criteria:**
- AC-1: A migration creates Tenant, LegalEntity, Brand, Location and TenantSettings (plus the document-sequence table); every tenant-owned table has `tenantId` NOT NULL, tenant-scoped unique constraints and composite (tenantId, id) foreign keys; `db:migrate:deploy`, `db:status` and `db:drift` are clean on dev and test.
- AC-2: Tenant isolation: for every endpoint, a request in tenant A cannot read, list, create-under, update or deactivate a record of tenant B; unknown or foreign ids return 404; tests cover every endpoint using the shared cross-tenant helper.
- AC-3: The tenant-scoped data access refuses to run without a tenant context (throws), injects `tenantId` into reads and writes, and a lint rule or test flags unscoped Prisma use outside platform code; an integration test on the Neon test branch proves a cross-tenant foreign key insert fails at the database.
- AC-4: `TenantGuard`: missing context gives 401; the `x-tenant-id` header works only when `NODE_ENV` is `development` or `test` and `ALLOW_DEV_TENANT_HEADER=true`; with `NODE_ENV=production` the header is ignored (401) even if the flag is set; unknown tenant gives 401; a suspended tenant gives 403 `TENANT_SUSPENDED`.
- AC-5: `GET /tenant` returns the current tenant; `PATCH /tenant` changes only `name` (2-120); id, slug, status and currency cannot be changed through the API (400 for unknown or immutable fields); no tenant create or delete endpoint exists.
- AC-6: Legal entity: exactly one per tenant (database unique on tenantId); `GET /legal-entity` and `PUT /legal-entity` (upsert) validate `legalName` (2-200, required) and the optional fields (tradingName, bin, tin, address, phone, email); values are trimmed; BIN/TIN are stored as free text without format validation.
- AC-7: Brands: create, list, get, patch and deactivate/reactivate exist and no DELETE endpoint exists; name is unique per tenant case-insensitively (1-100); code is 2-10 uppercase alphanumerics, unique per tenant and immutable (a PATCH containing `code` returns 400); duplicates return 409 with a stable error code; the same name and code may exist in two different tenants.
- AC-8: Locations: same CRUD and deactivate/reactivate rules; `type` is exactly one of `store`, `warehouse`, `online_fulfilment`; code is immutable and unique per tenant; optional `timezone` must be a valid IANA name (blank means tenant default); `legalEntityId` is set to the tenant's legal entity automatically; locations have no brand field (Q1).
- AC-9: Tenant settings: `GET` and `PATCH /tenant-settings`; defaults BDT, `Asia/Dhaka`, `en`; currency cannot be changed (400); `businessTimezone` is validated against the runtime tz database; `defaultLocale` is `en` or `bn`; a stale `version` returns 409 and a successful update increments it; document prefixes per document type are 1-6 uppercase alphanumerics; the number format, calendar-year reset, rounding (scale 2, half away from zero, per line) and `cashRounding=false` are fixed values returned by the API.
- AC-10: Document number service returns `PREFIX-YYYY-NNNNNN`, per tenant and document type, with the year taken from the business date in the location or tenant timezone (an instant of 2026-12-31T18:30Z in Asia/Dhaka numbers as 2027 and restarts at 000001); 50 concurrent allocations yield 50 unique consecutive numbers; tenants are independent; the counter increments inside the caller's transaction, so a rolled-back transaction does not consume a number.
- AC-11: Money rounding helper uses Decimal (never floats) and rounds half away from zero to 2 decimals: 0.005 gives 0.01, 2.675 gives 2.68, -0.005 gives -0.01, 1.004 gives 1.00; unit tests cover these and large values.
- AC-12: List endpoints (brands, locations) support `status` filter (active, inactive, all), stable sort (name ascending, active first), cursor pagination with `limit` default 50 and max 200 (201 returns 400).
- AC-13: Every mutation emits a structured log line with actor (null until FEAT-002), tenantId, entity, entityId, action and correlationId, and no personal data beyond ids.
- AC-14: A guarded, idempotent dev/test seed creates two demo tenants (each with legal entity, brand, locations, settings); it refuses production and the main Neon branch as in FEAT-000.
- AC-15: Request and response types live in `@ims/shared`; the web app imports them and does not redefine them.
- AC-16: Organization UI: tabs Business (tenant name + legal entity), Brands, Locations, Settings; create/edit forms with per-field server errors (including duplicate 409 and stale-version conflict), status filter and search, empty/loading/error/permission states, tenant name in the header, keyboard operable with labelled inputs; with no tenant context the UI shows an explicit message, not a blank page; strings go through the i18n structure and tokens from the theme.
- AC-17: Playwright specs cover create brand, duplicate brand code error, create and deactivate a location, edit settings with a conflict, and that tenant B's data never appears while acting as tenant A.
- AC-18: `pnpm turbo run lint typecheck build test`, `pnpm --filter api test:integration` and `pnpm --filter web test:e2e` all pass; new dependencies (if any) are recorded in `context/Library-docs.md`.

**Backend tasks (Rabbi):**
1. Prisma models and one reviewable migration for Tenant, LegalEntity, Brand, Location, TenantSettings and the document-sequence counter; composite keys and tenant-scoped unique indexes (case-insensitive name uniqueness via a lower-case unique index or citext).
2. Tenant context: `TenantContext` on the existing request context, `TenantGuard`, dev header resolver with the production fail-closed rule, `TENANT_SUSPENDED`.
3. Tenant-scoped Prisma client extension or repository helper, the lint rule or guard test for unscoped access, and a reusable cross-tenant test helper for later features.
4. Nest modules and endpoints per R12: `/tenant`, `/legal-entity`, `/brands`, `/locations`, `/tenant-settings`; DTO validation, 409 mapping of unique violations, optimistic `version` on settings; types in `@ims/shared`.
5. Document number service and rounding helper per AC-10 and AC-11, with concurrency and timezone tests.
6. Mutation logging (R10); guarded idempotent seed with two demo tenants.
7. Unit tests (Prisma mocked) and integration tests on the Neon test branch for isolation, composite FKs, uniqueness and concurrency; fill the Backend handoff with the API contract table.

**Frontend tasks (Shamim):** start after Rabbi's Backend handoff.
1. Organization area with Business, Brands, Locations and Settings tabs per R11, using the typed client and `@ims/shared`; tenant name in the header; dev tenant context wiring (`x-tenant-id` from a dev-only env/config, never in production builds).
2. Lists with search and status filter, forms with per-field server errors, deactivate/reactivate confirmations, conflict handling for settings, and all required states.
3. Register new reusable components in `context/ui-registry.md`; Playwright specs per AC-17; fill the Frontend handoff.

**QA focus (Tanvir):** Isolation first: try every endpoint with tenant A context against tenant B ids (read, update, deactivate, list leakage) and via the UI; production header rule (`NODE_ENV=production` with the flag set must still reject); immutability (code, slug, currency, id); duplicate/case variants of names and codes across two tenants; concurrent creates and concurrent document numbers; year-boundary numbering in Asia/Dhaka; rounding edge values; stale-version conflict; pagination limits; no raw DB errors or stack traces in responses; logs carry no personal data; seed guards; accessibility and states of the Organization UI; clean-clone full command run. Report any behaviour not specified here as a requirement gap.

## Backend handoff (Rabbi)

### FEAT-001.1-001.5: done 2026-10-12

**Built:**
- **Migration** `packages/db/prisma/migrations/20261012120000_tenancy_and_organization/migration.sql` (one migration; applied to `dev` and `test`). Tables `tenants`, `legal_entities`, `brands`, `locations`, `tenant_settings`, `document_sequences`; enums `tenant_status`, `record_status`, `location_type`. Every tenant-owned table has `tenant_id uuid NOT NULL` and FKs to `tenants` with `ON DELETE RESTRICT`. Tenant-scoped uniques: `legal_entities(tenant_id)` (one per tenant), `brands/locations (tenant_id, code)` and `(tenant_id, name_key)`, plus `UNIQUE (tenant_id, id)` on referenced tables. Composite FK `locations (tenant_id, legal_entity_id) -> legal_entities (tenant_id, id)`, so a location cannot point at another tenant's legal entity. CHECK constraints (not modelled by Prisma, ignored by the drift check): slug format, tenant name length, code format `^[A-Z0-9]{2,10}$`, country `^[A-Z]{2}$`, `currency_code = 'BDT'`, locale `en|bn`, `version >= 1`, prefixes are a JSON object, sequence value >= 1, year 2000-9999. Ids are UUID v7 (`@default(uuid(7))`). Reversal: drop the six tables and three enums (nothing else touched).
- **Case-insensitive names:** `name_key = lower(trim(name))` is written by the services and carries the unique index (an expression index would show up as drift in Prisma).
- **Tenant context** (`apps/api/src/tenancy/`): `RequestContext` now holds `tenantId`, `userId` (null until FEAT-002), `tenantAdmin`. `TenantContext.require()` throws `MissingTenantContextError`. `TenantGuard` is a **global guard** (`APP_GUARD`): every route needs an active tenant unless it is marked `@Public()` (health is public). The only resolver until FEAT-002 is the `x-tenant-id` header, and only when `NODE_ENV` is `development`/`test` **and** `ALLOW_DEV_TENANT_HEADER=true`. In production the header is never read, and a warning is logged at boot if the flag is set. `@RequireTenantAdmin()` marks mutations (the interim dev context is admin; FEAT-003 replaces it).
- **Tenant-scoped data access** (`apps/api/src/database/`): `tenant-scope.ts` (Prisma query extension: injects `tenantId` into every filter and write, refuses a different `tenantId`, refuses `tenant` relation writes and tenant changes, and refuses unregistered models, so new tables must be classified there). The `Tenant` row can only be read or updated as itself (`id = tenantId`); create, delete and upsert on it are platform-only. `TenantPrismaService` (`.client`, `.transaction(fn)`) is the only access for tenant data. Unscoped `PrismaService` is platform-only, enforced by an ESLint `no-restricted-imports` rule in `eslint.config.mjs` (allow-list: `database/`, `health/`, `testing/`, `tenancy/tenant-lookup.service.ts`, `tenancy/tenant-provisioning.service.ts`, specs) and by the guard test `database/unscoped-prisma.spec.ts`. Raw SQL is not intercepted; it must filter `tenant_id` explicitly.
- **Modules/endpoints:** `TenancyModule` with `tenant/`, `legal-entity/`, `brands/`, `locations/`, `settings/` (controller -> service, class-validator DTOs, unique violation -> 409 `DUPLICATE_VALUE` with the field, optimistic `version` on settings). `TenantProvisioningService` (platform: tenant + default settings in one transaction; no HTTP endpoint). `MutationLogService` (AC-13). Location deactivation hook: `LOCATION_DEACTIVATION_CHECKS` (empty now; inventory/POS features register blocking checks; they run inside the deactivation transaction).
- **Document numbers** `tenancy/document-numbers/document-number.service.ts`: `allocate(tx, { documentType, occurredAt, locationId? })` returns `{ number, prefix, year, sequence, businessDate, timeZone }`. The year comes from the business date in the location timezone, else the tenant timezone. One `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on `document_sequences (tenant_id, document_type, year)` inside the caller's transaction: the row lock serialises concurrent callers and a rollback gives the number back. Format helpers in `document-number.ts`.
- **Money/time helpers:** `common/money/money.ts` (`roundMoney`, `formatMoney`, `lineAmount`, `sumMoney`, `toDecimal`: Prisma `Decimal`, `ROUND_HALF_UP` = half away from zero, 2 dp, JS numbers refused). `common/time/business-date.ts` (`businessDate`, `isValidTimeZone`, `effectiveTimeZone`).
- **Seed** `packages/db/src/seed.ts` + `seed-data.ts`: two fictional demo tenants with fixed ids (`DEMO_TENANT_IDS` in `@ims/shared`). Dhaka Threads has 2 brands and 3 locations (store, warehouse, online). Chattogram Wear has 1 brand and 2 locations (the `WEB` code is reused on purpose). Each tenant also gets a legal entity and default settings. Upserts with empty updates (idempotent). The FEAT-000 guards still apply.
- **Test helpers for later features:** `apps/api/src/testing/tenant-isolation.ts` (`expectCrossTenantNotFound`, `expectListExcludes`, `listAllIds`), `testing/tenant-fixtures.ts` (`provisionTestTenant`, `deleteTestTenants`).
- **Shared types** `packages/shared/src/tenancy.ts` (exported from `@ims/shared`): `TenantDto`, `UpdateTenantRequest`, `LegalEntityDto`, `UpsertLegalEntityRequest`, `BrandDto`, `CreateBrandRequest`, `UpdateBrandRequest`, `LocationDto`, `CreateLocationRequest`, `UpdateLocationRequest`, `TenantSettingsDto`, `UpdateTenantSettingsRequest`, `Address`, `AddressInput`, `Page<T>`, `ListQuery`, `StatusFilter`, `RecordStatus`, `TenantStatus`, `LocationType` + `LOCATION_TYPES`, `Locale` + `LOCALES`, `DocumentType` + `DOCUMENT_TYPES` + `DEFAULT_DOCUMENT_PREFIXES`, `RoundingPolicy`, `TenancyErrorCode`, `TENANCY_LIMITS` (form limits/patterns), `DEV_TENANT_HEADER`, `DEMO_TENANT_IDS`. `@ims/db` also exports the model types and `DEMO_TENANTS`.
- Other changed files: `apps/api/src/app.module.ts`, `config/env.validation.ts` (`ALLOW_DEV_TENANT_HEADER`), `common/errors/error-codes.ts` (+ tenancy codes), `common/errors/prisma-errors.ts`, `health/health.controller.ts` (`@Public()`), `vitest.config.ts`/`vitest.integration.config.ts` (flag on for tests), `turbo.json` (`ALLOW_DEV_TENANT_HEADER` for `test:integration`, `dev` passThroughEnv), `.env.example`, `app.spec.ts` and Tanvir's `qa/http-edge-cases.spec.ts` (only `@Public()` added on the probe controllers, needed because of the global guard).

**API contract:** all bodies JSON, all instants ISO UTC strings. Header until FEAT-002: `x-tenant-id: <tenant uuid>` (dev/test only, see Auth). Errors use the FEAT-000 `ApiErrorBody` `{statusCode, code, message, details?, correlationId}`. Every tenant route can return **401 `TENANT_CONTEXT_REQUIRED`** (no/malformed/unknown tenant, or header not allowed, e.g. production) and **403 `TENANT_SUSPENDED`**. Mutations can also return 403 `TENANT_ADMIN_REQUIRED` (not reachable with the dev context). Unknown body or query properties return 400 `VALIDATION_FAILED` with `details[].field`.

| Method | Path | Request | Response | Errors | Auth |
|---|---|---|---|---|---|
| GET | `/tenant` | none | 200 `TenantDto` `{id, slug, name, status, createdAt, updatedAt}` | 401, 403 | Tenant context |
| PATCH | `/tenant` | `UpdateTenantRequest` `{name}` (2-120, trimmed) | 200 `TenantDto` | 400 `VALIDATION_FAILED` (`name`; `id`/`slug`/`status`/`currencyCode` give "`<field>` cannot be changed") | Tenant context + admin |
| GET | `/legal-entity` | none | 200 `LegalEntityDto` `{id, legalName, tradingName, bin, tin, address{line1,line2,city,district,postalCode,country}, phone, email, createdAt, updatedAt}` | 404 `NOT_FOUND` until created (treat as the empty state) | Tenant context |
| PUT | `/legal-entity` | `UpsertLegalEntityRequest` `{legalName (2-200), tradingName?, bin? (≤50 free text), tin? (≤50), address?{line1?,line2? ≤200, city?,district? ≤100, postalCode? ≤20, country? ISO alpha-2, default BD}, phone? (3-30 of digits/space/+()-), email?}`; trimmed; blank -> null; **omitted optional fields are cleared** | **201** created / **200** replaced, `LegalEntityDto` | 400 (field details) | Tenant context + admin |
| GET | `/brands` | query `ListQuery` `status=active\|inactive\|all` (default `all`), `q` (name/code contains, case-insensitive, ≤100), `limit` 1-200 (default 50), `cursor` | 200 `Page<BrandDto>` `{items, nextCursor}`; sort: active first, then name (case-insensitive), then id | 400 (`limit` 0/201/non-int, bad `status`, bad `cursor`) | Tenant context |
| GET | `/brands/:id` | none | 200 `BrandDto` `{id, name, code, status, createdAt, updatedAt}` | 404 `NOT_FOUND` (unknown, malformed or other tenant: same body) | Tenant context |
| POST | `/brands` | `CreateBrandRequest` `{name (1-100), code (^[A-Z0-9]{2,10}$)}` | 201 `BrandDto` | 400; 409 `DUPLICATE_VALUE` `details:[{field:'code'\|'name'}]` (name is case-insensitive) | Tenant context + admin |
| PATCH | `/brands/:id` | `UpdateBrandRequest` `{name?}` | 200 `BrandDto` | 400 (`code`/`status`/`id` -> "cannot be changed"); 404; 409 `DUPLICATE_VALUE` (`name`) | Tenant context + admin |
| POST | `/brands/:id/deactivate` | none | 200 `BrandDto` (`status:'inactive'`; idempotent) | 404 | Tenant context + admin |
| POST | `/brands/:id/reactivate` | none | 200 `BrandDto` (`status:'active'`; idempotent) | 404 | Tenant context + admin |
| GET | `/locations` | same query as `/brands` | 200 `Page<LocationDto>` | 400 | Tenant context |
| GET | `/locations/:id` | none | 200 `LocationDto` `{id, name, code, type, address, phone, timezone, legalEntityId, status, createdAt, updatedAt}` (no brand field) | 404 | Tenant context |
| POST | `/locations` | `CreateLocationRequest` `{name (1-100), code (^[A-Z0-9]{2,10}$), type ('store'\|'warehouse'\|'online_fulfilment'), address?, phone?, timezone? (IANA; ''/null = tenant default)}` | 201 `LocationDto` (`legalEntityId` set by the server) | 400 (`legalEntityId`/`status`/unknown e.g. `brandId` refused); **422 `LEGAL_ENTITY_REQUIRED`** when the legal entity does not exist yet; 409 `DUPLICATE_VALUE` (`code`\|`name`) | Tenant context + admin |
| PATCH | `/locations/:id` | `UpdateLocationRequest` `{name?, type?, address? (merged field by field), phone? (null clears), timezone? (null/'' clears)}` | 200 `LocationDto` | 400 (`code` immutable, bad tz/type); 404; 409 | Tenant context + admin |
| POST | `/locations/:id/deactivate` | none | 200 `LocationDto` (idempotent) | 404; 409 `CONFLICT` if a future registered blocking check refuses (none in FEAT-001) | Tenant context + admin |
| POST | `/locations/:id/reactivate` | none | 200 `LocationDto` (idempotent) | 404 | Tenant context + admin |
| GET | `/tenant-settings` | none | 200 `TenantSettingsDto` `{currencyCode:'BDT', businessTimezone, defaultLocale:'en'\|'bn', documentPrefixes: Record<DocumentType,string> (effective, all types), documentNumberFormat:'PREFIX-YYYY-NNNNNN', documentNumberReset:'calendar_year', rounding:{scale:2, mode:'half_away_from_zero', level:'line', cashRounding:false}, version, updatedAt}` | 401/403 | Tenant context |
| PATCH | `/tenant-settings` | `UpdateTenantSettingsRequest` `{version (required, int ≥1), businessTimezone? (IANA), defaultLocale? ('en'\|'bn'), documentPrefixes? (partial map, each ^[A-Z0-9]{1,6}$, merged)}` | 200 `TenantSettingsDto` with `version + 1` | 400 (`currencyCode` "cannot be changed (BDT only)", `rounding`/`documentNumberFormat`/`documentNumberReset` immutable, bad tz/locale/prefix/unknown type, **prefixes shared by two document types**); **409 `VERSION_CONFLICT`** `details:[{field:'version'}]` for a stale version or a lost concurrent race | Tenant context + admin |

No `DELETE` routes and no tenant create route exist (404 from the router). Default document prefixes: `purchase_order PO`, `goods_receipt GRN`, `supplier_return SR`, `stock_transfer TRF`, `stock_adjustment ADJ`, `stock_count CNT`, `sale INV`, `sales_return RET`, `online_order ORD`.

**Env vars added:** `ALLOW_DEV_TENANT_HEADER` (`true`/`false`, optional, default off). Effective only with `NODE_ENV` development/test. Added to `.env.example`. I also appended `ALLOW_DEV_TENANT_HEADER=true` to the local git-ignored `.env` (dev; the key only, nothing else changed or printed). The test configs set it themselves.

**Migration:** `20261012120000_tenancy_and_organization`.

**Unit tests:** command / result
- `pnpm install --frozen-lockfile`: pass (no new dependencies; nothing to add to `Library-docs.md`)
- `pnpm turbo run lint typecheck build test --force`: **15/15 tasks pass**. api unit **259 passed** (17 files; coverage statements 80.8%, branches 75.3%: controllers/services are mostly covered by the integration suite). @ims/db **16 passed**.
- `pnpm format:check`: pass
- `pnpm --filter api test:integration` (Neon test branch): **27 passed** (3 files: `health` 3, `tenancy/tenancy.int-spec.ts` 17, `tenancy/document-numbers/document-number.int-spec.ts` 7). These cover: isolation on every id endpoint and list using the shared helper; DB refusal of a cross-tenant composite FK (Prisma P2003 and raw SQL); the scoped client throwing without a context or for a foreign `tenantId`; 5 concurrent identical brand creates giving one 201 and four 409; case-insensitive duplicates; the same name/code allowed in two tenants; a 3-page cursor walk in the expected order; stale and concurrent settings PATCH (one 200, one 409); the DB refusing USD; **50 concurrent document number allocations giving 1..50 with no duplicates**; a rollback not consuming a number; 2026-12-31T18:30Z in Asia/Dhaka giving `PO-2027-000001`; a location UTC override giving 2026; tenant independence; a foreign location returning 404.
- DB: `db:migrate:deploy` + `db:migrate:deploy:test` applied the migration. `db:status` / `db:status:test` report "Database schema is up to date!". Drift on dev and on test reports "No difference detected." (exit 0). `db:seed` twice on dev and `db:seed:test` both give "2 demo tenants, 3 brands, 5 locations". The seed refuses `NODE_ENV=production` and an empty `NEON_MAIN_BRANCH_ID`.
- Live API (`node dist/main.js`, dev branch, port 3021, `NODE_ENV=test` + flag):
  - No tenant: 401 `TENANT_CONTEXT_REQUIRED`. `GET /tenant` as demo A: 200.
  - Demo A against demo B's brand/location (GET, PATCH, deactivate): 404 `NOT_FOUND`.
  - Duplicate code: 409 `DUPLICATE_VALUE` field `code`. PATCH `code`: 400 "code cannot be changed". `limit=201`: 400.
  - Settings: defaults returned. Stale version: 409 `VERSION_CONFLICT`. `currencyCode`: 400. `DELETE /brands/:id`: 404.
  - A mutation log line had `event:"tenant_data_mutation", actor:null, tenantId, entity:"tenant", entityId, action:"update", correlationId:"curl-mut-1"`.
  - Same build with `NODE_ENV=production ALLOW_DEV_TENANT_HEADER=true` (port 3022): `GET /tenant` and `POST /brands` with a valid header gave 401 `TENANT_CONTEXT_REQUIRED`, `/health` gave 200, and the boot warning "ALLOW_DEV_TENANT_HEADER is ignored ..." was logged.

**Limitations:**
- Tenant isolation is application-level plus DB constraints (R1). No RLS. Raw SQL is not scoped by the extension: every raw query must include `tenant_id` (the document number service does).
- Nested Prisma relation writes/reads through the scoped client are not individually scoped. The composite FKs make cross-tenant links impossible anyway. Later features should keep using flat writes with ids.
- The global guard means **every new controller requires a tenant unless it is marked `@Public()`**, which is fail closed by design.
- Document numbers are not gap-free: a number allocated inside a transaction that commits is never reused, but there is no reservation or void handling (revisit with D-05). A sequence above 999999 in one year widens to 7 digits instead of failing.
- `PATCH /tenant` has no version (last write wins). Only settings are versioned, per R8.
- Deactivating the last active location or the only brand is allowed. The API sends no warning flag (R-gap list says "warning only"), so the UI may warn.
- `name_key` uses JS `toLowerCase()` (Unicode-aware). Internal whitespace is not collapsed ("A  B" and "A B" are different names).
- The mutation log line carries `correlationId` twice (the pino request prop and the entry, same value).
- Coverage of unit tests alone fell from 95% to 81% because the HTTP services are exercised mainly by the integration suite.

**Choices for Minhaj to confirm (routine, reversible; not business rules):**
1. `POST /locations` before the legal entity exists returns 422 `LEGAL_ENTITY_REQUIRED`, following the onboarding order tenant -> legal entity -> locations. The alternative is to auto-create a legal entity from the tenant name.
2. Prefixes shared by two document types are rejected (400), so human numbers stay unique (code-standards).
3. The document type registry and default prefixes listed above. Later features add their types to `DEFAULT_DOCUMENT_PREFIXES`.
4. Lists default to `status=all` and also support `q` search, which the Organization UI needs.

**Notes for Shamim:**
- Import every type from `@ims/shared` (see list above). Use `TENANCY_LIMITS` for client-side form rules and `LOCATION_TYPES`/`LOCALES`/`DOCUMENT_TYPES` for selects. Match errors on `code` (`TenancyErrorCode`) and render `details[].field` per input (nested address fields come as `address.city`, etc.).
- Dev tenant: send `x-tenant-id` (`DEV_TENANT_HEADER`) with `DEMO_TENANT_IDS.dhakaThreads` / `.ctgWear`, from dev-only config, never in a production build. The API needs `NODE_ENV=development` + `ALLOW_DEV_TENANT_HEADER=true` (both already in the local `.env`). Because the request carries a custom header, browser calls trigger a CORS preflight. I checked it live: an OPTIONS request from `http://localhost:3000` asking for `x-tenant-id,content-type` returns 204 and allows both headers.
- Run `pnpm --filter @ims/db db:seed` (dev) or `db:seed:test` to (re)create the demo tenants. Playwright can use them, or provision its own data through the API.
- Business tab: `GET /legal-entity` 404 is the "not set up yet" empty state; `PUT` returns 201 the first time. Locations: show the 422 `LEGAL_ENTITY_REQUIRED` message with a link to the Business tab.
- Settings form: keep `version` from GET and send it back. On 409 `VERSION_CONFLICT`, reload and show the conflict state. `currencyCode`, number format, reset and rounding are read-only display values.
- Lists: send `status`, `q`, `limit`, and pass `nextCursor` back as `cursor` ("Load more"). Deactivate/reactivate are `POST .../deactivate|reactivate` (200, idempotent).

**Notes for Tanvir:**
- Isolation helper: `apps/api/src/testing/tenant-isolation.ts`. Demo ids are in `DEMO_TENANT_IDS`. Integration tests create and delete their own `it-*` tenants on the test branch.
- To check the production rule live: `NODE_ENV=production ALLOW_DEV_TENANT_HEADER=true PORT=<free> node --env-file-if-exists=../../.env dist/main.js` from `apps/api`. Every tenant route should answer 401.
- Suspended tenant: set `tenants.status='suspended'` on a test tenant to get 403 `TENANT_SUSPENDED`; there is no API to do this (FEAT-044).
- Concurrency proofs are in the integration suite (50 allocations, 5 concurrent brand creates, settings race). Year-boundary cases are in `document-number.spec.ts` / `.int-spec.ts`. Rounding edge values are in `common/money/money.spec.ts`.
- DB-level checks worth repeating by hand: the composite FK, `currency_code` CHECK and the one-legal-entity unique (see `tenancy.int-spec.ts`).

## Minhaj review of backend handoff (2026-10-12)

All choices below are routine and reversible; none is a business policy, so nothing is escalated and no fix item is raised for Rabbi.

| # | Rabbi's choice | Decision | Reason |
|---|---|---|---|
| 1 | `POST /locations` before the legal entity exists returns 422 `LEGAL_ENTITY_REQUIRED` | Confirmed | Follows the onboarding order tenant, legal entity, locations (workflow.md). Auto-creating a legal entity from the tenant name would invent legal data. FEAT-043 wizard must create the legal entity first. |
| 2 | Document-type prefixes must be unique per tenant (400) | Confirmed | Human document numbers must stay unambiguous (code-standards). |
| 3 | Document types and default prefixes PO, GRN, SR, TRF, ADJ, CNT, INV, RET, ORD | Confirmed | Matches the planned documents; later features add types to `DEFAULT_DOCUMENT_PREFIXES` rather than redefining them. Tenants can change prefixes in settings. |
| 4 | Lists default to `status=all` and support `q` search | Confirmed | UI needs both; the UI default filter shows active. |
| 5 | `TenantGuard` is global with `@Public()` opt-out; `@Public()` added to Tanvir's QA probe controllers | Confirmed | Fail closed by design. Rule for later features: every new public route (for example webhooks in FEAT-031) is `@Public()` and must have its own authentication; reviewers check this. The QA spec edit is harmless. |
| 6 | `ALLOW_DEV_TENANT_HEADER=true` appended to the git-ignored local .env | Confirmed | Dev only; ignored when `NODE_ENV=production` and warned at boot. |
| 7 | `PUT /legal-entity` clears omitted optional fields | Confirmed | Standard PUT replace semantics; documented in the contract. |

**Known limits accepted:**
- Raw SQL is not auto-scoped: accepted with a standing rule that every raw query includes `tenant_id` and is covered by an isolation test; Tanvir checks this in every feature that adds raw SQL (FEAT-031 job claiming is platform-level and restores tenant context before handlers run).
- Numbers are not gap-free and there is no void handling: accepted per user answer Q3 (gap-free only where legally required, revisit with D-05).
- A sequence above 999999 in a year widens to 7 digits: accepted (practically unreachable).
- `PATCH /tenant` is last-write-wins: accepted; it only edits the name.
- Deactivating the last location or only brand is allowed with no API warning flag: accepted; the UI may warn.
- Nested Prisma relation writes are not individually scoped: accepted because composite foreign keys make cross-tenant links impossible; keep flat writes.

## Frontend handoff (Shamim)

### FEAT-001.1-001.5 Organization UI: done 2026-10-12

**Built:**
- Routes (App Router, data through the typed client in client components): `/organization` (redirects to Business), `/organization/business`, `/organization/brands`, `/organization/locations`, `/organization/settings`. Header on every page: app nav (Home, Organization), tenant name ("Organization: <name>", `data-testid="tenant-name"`) and the dev organization switcher.
- **Business:** organization name form (`PATCH /tenant`; the header refreshes without a loading flash) and legal entity form (`GET`/`PUT /legal-entity`; 404 is the "no legal entity yet" empty state; all fields incl. address; BIN/TIN free text).
- **Brands and Locations:** debounced search (300 ms), status filter (All/Active/Inactive), "Load more" cursor paging; create and edit in an inline panel (code is immutable: disabled on edit, upper-cased on input, client pattern check); the location form has type, phone, optional time zone override and address; deactivate/reactivate through a modal confirm dialog (warns "This is your only active brand/location" when the loaded list is complete); status is text plus a symbol.
- **Settings:** BDT, number format, calendar-year reset, rounding and cash rounding are read-only; editable business time zone, default language and the nine document prefixes; `version` from GET is sent back; stale version (409 `VERSION_CONFLICT`) shows a conflict panel with "Load latest settings"; 400 prefix errors show on the form.
- **States:** loading, empty (plain and filtered), network error with retry, API error with correlation id, 401 `TENANT_CONTEXT_REQUIRED` ("No organization context", never a blank page), 403 `TENANT_SUSPENDED` and generic permission denied, 404 (record gone), validation errors per field (nested `address.*` too), 409 `DUPLICATE_VALUE` shown as "This <field> is already used...", 422 `LEGAL_ENTITY_REQUIRED` with a link to the Business tab. The form error summary receives focus; inputs have labels, hints, `aria-invalid` and `aria-describedby`; tabs are real links with `aria-current`; dialogs use native `<dialog>`.
- **Dev tenant context (isolated, replaced by FEAT-002):** `apps/web/src/lib/dev-tenant.ts`, `components/dev-tenant-switcher.tsx`, and the header line in `apiFetch` (`lib/api/client.ts`). Enabled only when `next dev` runs (NODE_ENV=development) or a build sets `NEXT_PUBLIC_DEV_TENANT_ENABLED=true` (Playwright's webServer does). A normal production build leaves it off: no header is sent and no switcher renders. `next.config.ts` also fails the build when the flag is set with `VERCEL_ENV=production`. The id comes from `localStorage ims.devTenantId`, else `NEXT_PUBLIC_DEV_TENANT_ID`, else the demo Dhaka Threads id. `GET /health` never sends the header. FEAT-002 should delete `dev-tenant.ts`, the switcher and that header line.
- i18n: all strings in `src/i18n/messages.en.ts` (typed keys). Theme tokens only. Types come from `@ims/shared`; none redefined.
- New components are registered in `context/ui-registry.md` (Implemented components). No new npm dependencies, so nothing to add to `Library-docs.md`.
- Other files touched: `apps/web/playwright.config.ts` (`workers: 1` because both real-API specs start the API on one port; webServer env `NEXT_PUBLIC_DEV_TENANT_ENABLED=true`); new `apps/web/turbo.json` (extends root; web `typecheck` also depends on web `build`, because `next-env.d.ts` imports files generated by the build and a parallel run was flaky; tsconfig no longer lists `.next/types`). Root files, `apps/api` and `packages/db` untouched.

**Playwright:**
- `apps/web/e2e/organization.spec.ts` (21 tests, stateful fake API in `e2e/helpers/fake-api.ts`, no backend): AC-16 header and tabs, no-tenant message, API down + retry, legal entity empty/validation/create, tenant rename, client checks, edit and confirm dialogs, search/filter/empty, load more, list error, 404 in dialog, duplicate code/name, 422 link, settings read-only fields and save; AC-17 create brand, duplicate brand code, create and deactivate location, settings stale-version conflict then retry, tenant A/B isolation (UI switch, and exactly one `x-tenant-id` on every request), labelled controls and landmarks.
- `apps/web/e2e/organization-real-api.spec.ts` (4 tests, real API on the Neon **test** branch via `.env.test`; the guarded `db:seed:test` runs in beforeAll through the existing seed hook; skips when there are no test-branch settings or the API port is taken): AC-17 create brand then duplicate code error, create and deactivate a location, settings conflict (version bumped through the API) then reload and save, tenant B brand never shown to tenant A (and 404 across tenants through the API). Rows it creates are deactivated at the end.
- Command `pnpm --filter web test:e2e`. Results: **32 passed, 11 skipped** with defaults (all skips are real-API specs: port 3001 was held by someone's `node --watch dist/main.js` dev API, which was left alone); **43 passed, 0 skipped** with `NEXT_PUBLIC_API_URL=http://localhost:3011` (all real-API specs ran: Tanvir's FEAT-000 ones and the Organization flows against the real API and test branch).

**Checks (2026-10-12, Node 24.19.0, pnpm 10.34.6):**
- `pnpm turbo run lint typecheck build`: 13/13 tasks pass
- `pnpm format:check`: pass
- `pnpm --filter web test:e2e`: see above

**Notes for QA:**
- Run the full suite with a free API port: `NEXT_PUBLIC_API_URL=http://localhost:3011 pnpm --filter web test:e2e` (the value is used for the build and the specs), or stop anything on :3001. Real-API specs need `.env.test` (test branch) and never use dev or main.
- Manual check: `pnpm --filter @ims/db db:seed`, run the API (NODE_ENV=development, ALLOW_DEV_TENANT_HEADER=true, WEB_ORIGIN=http://localhost:3000), `pnpm --filter web dev`, open /organization. Switching the dev organization in the header must change all data.
- Production rule: a production build without `NEXT_PUBLIC_DEV_TENANT_ENABLED` sends no `x-tenant-id` and shows no switcher, so Organization shows "No organization context" until FEAT-002 (expected). The API ignores the header in production anyway.
- Edge cases worth probing: very long names (maxLength follows the API limits), lower-case codes (upper-cased on input), blank time zone on a location (business default), deactivating a record another user already removed (404 text in the dialog), a second admin saving settings first (conflict), clearing address fields on edit (sends null).
- Not covered by design: permission-denied UI beyond the generic 403 message (roles are FEAT-003), Bangla strings, axe scan, tablet layouts beyond responsive wrapping.

**Notes for Minhaj and Rabbi:**
- No API gaps found.
- The last-active warning is computed from the loaded list (complete and unfiltered), because the API sends no flag.
- `GET /tenant` is called from the header on every page, including Home.

## QA report (Tanvir)

**Date / environment:** 2026-10-12, Windows 11, Node 24.19.0, pnpm 10.34.6, main at 01ff172. Clean verification was done in a fresh `git clone` of main (separate folder, so the developers' running dev servers on :3000/:3001 were not disturbed) with `.env`/`.env.test` copied in. Real-API checks used free ports (3011, 3031-3037). DB-backed tests ran on the Neon TEST branch only. FEAT-031's additive migration on the shared Neon branches (5 tables, 3 enums, brand trigger) makes `db:status` and a whole-database drift check non-clean; that is expected and NOT a FEAT-001 defect. Drift was judged on FEAT-001 objects only.

**Commands run / results:**

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (fresh clone) | pass |
| `pnpm turbo run lint typecheck build test --force` | 15/15 pass. api unit 303 passed (18 files, incl. QA money/boundary spec), @ims/db 16 passed |
| `pnpm format:check` | pass |
| `pnpm --filter api test:integration` | 122 passed + 4 expected-fail (6 files; 27 developer tests + 95 QA tests) |
| `NEXT_PUBLIC_API_URL=http://localhost:3011 pnpm --filter web test:e2e` | 54 passed, 0 skipped (43 developer + 11 new QA UI tests) |
| `pnpm --filter web test:e2e` with defaults (port 3001 is held by someone's dev API) | 32 passed, 22 skipped (all skips are real-API specs by design) |
| `db:status:test` | "Database schema is up to date!" (migration list now also includes FEAT-031's; see above) |
| Drift on test and dev | only FEAT-031 tables/enums appear; no difference on `tenants`, `legal_entities`, `brands`, `locations`, `tenant_settings`, `document_sequences` |
| Schema audit (information_schema/pg_indexes on test branch, now an automated test) | all 5 tenant-owned tables have `tenant_id uuid NOT NULL` + FK to `tenants` ON DELETE RESTRICT; unique `(tenant_id,code)`, `(tenant_id,name_key)`, `(tenant_id,id)` on brands and locations, no global unique on code/name_key; `legal_entities(tenant_id)` unique; location FK is composite `(tenant_id, legal_entity_id)` |
| `db:seed:test` twice | "2 demo tenants ..." both times; row ids/updatedAt/status/version hash identical before/after (idempotent). Refused: `NODE_ENV=production`, empty `NEON_MAIN_BRANCH_ID`, `NEON_BRANCH_ID`=main id, `DB_TARGET=prod` |
| Lint rule (temporary files in the clone, deleted) | importing `PrismaService`, `createPrismaClient` or `PrismaClient` outside the allow-list fails ESLint (3 errors); the `unscoped-prisma.spec.ts` guard test also passes |
| Production header rule, live API (own instance) | `NODE_ENV=production` + `ALLOW_DEV_TENANT_HEADER=true`: GET /tenant, GET /brands, POST /brands all 401, `/health` 200, boot warning logged. `development` without the flag: 401. `test` + flag: 200. Flag `TRUE`, or empty value: API refuses to start ("must be true or false") |
| Production web build | `NEXT_PUBLIC_DEV_TENANT_ENABLED=true VERCEL_ENV=production next build` fails ("must not be set for a production deployment"); with `VERCEL_ENV=preview` it builds. A plain production build sends NO `x-tenant-id` (also not after injecting `localStorage ims.devTenantId`) and renders no switcher |
| Mutation log (live) | one `tenant_data_mutation` line per mutation with `actor:null`, tenantId, entity, entityId, action, correlationId; sentinel email, phone, BIN, address and names never appear in the log |

**New QA automation (kept in the suite):**
- `apps/api/src/qa/tenancy-qa.int-spec.ts` (Neon test branch, 78 tests, 4 expected-fail for the bugs below): isolation of every endpoint incl. legal entity/settings/tenant, id spellings and cursor reuse, 404 body identical for foreign vs unknown id, no DELETE/POST-tenant routes, guard header parsing, immutability of code/status/id/tenantId/currency, validation matrix (names, codes, unicode, NUL, long, null, wrong types) with "no 5xx, no raw DB error text", case/space duplicates, settings `version` edge values and prefix rules (including swap), pagination/limits/status/sort, concurrency (legal entity first PUT, location/brand duplicates, flip-flop, settings race), 120-request tenant-context bleed test, DB CHECK/unique/RESTRICT checks and the schema audit.
- `apps/api/src/qa/document-number-qa.int-spec.ts` (9 tests): exact Dhaka midnight boundary, back-dated documents, 50 concurrent allocations across the year boundary, types and tenants independent under concurrency, rollbacks under concurrency leave consecutive numbers, prefix change, tenant timezone change, location timezone override, bad input, 7-digit widening.
- `apps/api/src/qa/money-qa.spec.ts` (44 tests): rounding table (0.005, 1.005, 2.675, negatives, huge values, never "-0.00"), refusal of numbers/NaN/exponents, per-line vs sum, business-date and DST/leap boundaries, timezone name validation, document number format.
- `apps/api/src/qa/tenancy-qa-logging-suspension.int-spec.ts` (13 tests): exactly one log call per successful mutation and none for 400/404/409/no-ops, ids only; suspended tenant gets 403 `TENANT_SUSPENDED` on all 18 routes while `/health` stays public; body-type robustness (text, form, null, array, empty, truncated, deep nesting, `__proto__`).
- `apps/web/e2e/qa/org-ui-qa.spec.ts` (11 tests, real API + test branch): markup shown as text and never executed, no horizontal scroll at 375 px on all tabs, labels/h1/lang/title/aria-current, Escape + focus return + focus not leaking behind the modal dialog, validation focus, double-click Create creates one row, case-variant duplicate shown on the name field, code upper-casing and read-only on edit, tenant switching + reload + corrupt stored id, loading state, 403 state.

**AC results:**

| AC | Result | Notes |
|---|---|---|
| AC-1 | PASS | Schema audit above; migration applied, FEAT-001 objects drift-free on dev and test. |
| AC-2 | PASS | Every id endpoint cross-tenant 404 (all verbs, UPPERCASE id), identical body to an unknown id, lists/search/cursors never leak, 120 interleaved requests show no context bleed, UI tenant A/B. |
| AC-3 | PASS | Scoped client throws without context (existing tests), lint rule and guard test verified by negative test, composite FK rejected by the DB. |
| AC-4 | PASS | 401/403 matrix, header normalisation, production ignored even with the flag (live), suspended on all routes. |
| AC-5 | PASS | Only `name` changes; id/slug/status/currency/tenantId refused with 400; no create/delete route. Related defect BUG A (NUL) affects the name field. |
| AC-6 | FAIL (partial) | Validation and trimming correct; a NUL character in `legalName`, `bin` or address returns 500 (BUG A). |
| AC-7 | FAIL (partial) | Everything specified holds (409, case-insensitive, immutable code, same name/code in two tenants, no DELETE); NUL in `name` returns 500 (BUG A). |
| AC-8 | FAIL (partial) | Specified rules hold; NUL in `name` returns 500 (BUG A). |
| AC-9 | FAIL (partial) | Version/409/prefix/timezone/currency rules hold, but `businessTimezone: null` and `defaultLocale: null` return 500 instead of 400 (BUG B). |
| AC-10 | PASS | Boundary, concurrency, rollback, independence, timezone cases all pass. |
| AC-11 | PASS | Edge values incl. half-cent sweep 0..2.005, negatives, 18-digit values; never "-0.00". |
| AC-12 | FAIL (partial) | Filter, sort and limits correct (201/0/-1/abc give 400); a crafted `cursor` gives 500 (BUG C) and `q=%` or `q=_` matches every row (BUG D). |
| AC-13 | PASS | See mutation-log evidence. |
| AC-14 | PASS | Idempotent (hash identical), guards verified. Test branch accumulates inactive rows from e2e runs (not a defect). |
| AC-15 | PASS | UI imports `@ims/shared` types (no redefinition found in `apps/web/src`). |
| AC-16 | PASS | All states and accessibility checks pass, including the QA UI suite. |
| AC-17 | PASS | Developer specs plus QA specs pass against the real API. |
| AC-18 | PASS | Full command set passes from a clean clone; no new dependencies. |

**Bugs found:**

- Title: NUL character in any free-text field returns 500
  Severity: Medium
  Suspected layer: Backend (DTO validation does not reject U+0000; PostgreSQL then refuses the value, so the global filter answers 500 INTERNAL_ERROR; affects tenant name, legal entity fields, brand/location names and the `q` search)
  Steps to reproduce: 1. As any tenant, `POST /brands` with `{"name":"a\u0000b","code":"NUL1"}` (same for `POST /locations`, `PATCH /tenant`, `PUT /legal-entity` with `legalName` or `bin`, `GET /brands?q=a%00b`). 2. Observe the status.
  Expected: 400 `VALIDATION_FAILED` with the field named.
  Actual: 500 `INTERNAL_ERROR` and a server error log per request.
  Evidence: `apps/api/src/qa/tenancy-qa.int-spec.ts` "NUL (\u0000) in brand/location/tenant/legal-entity text and in q returns 400, never 500" (`it.fails`).

- Title: null for businessTimezone or defaultLocale in PATCH /tenant-settings returns 500
  Severity: Low
  Suspected layer: Backend (optional-field DTO lets `null` through; NOT NULL column rejects it)
  Steps to reproduce: 1. `GET /tenant-settings` for the version. 2. `PATCH /tenant-settings` `{"version":<v>,"businessTimezone":null}` (or `"defaultLocale":null`).
  Expected: 400 `VALIDATION_FAILED` on that field.
  Actual: 500 `INTERNAL_ERROR`.
  Evidence: `tenancy-qa.int-spec.ts` "null businessTimezone / defaultLocale is rejected with 400, not 500" (`it.fails`).

- Title: Crafted pagination cursor returns 500
  Severity: Low
  Suspected layer: Backend (`decodeCursor` checks only the JSON shape; the `i` value must be a UUID and `n` must not contain NUL before it reaches PostgreSQL)
  Steps to reproduce: 1. `GET /locations?cursor=<base64url of {"s":"active","n":"zzz","i":"not-a-uuid"}>` (same for `/brands`; also `n` containing `\u0000`).
  Expected: 400 `VALIDATION_FAILED` on field `cursor` (as for any other invalid cursor).
  Actual: 500 `INTERNAL_ERROR`.
  Evidence: `tenancy-qa.int-spec.ts` "a crafted cursor with a non-uuid id or NUL name returns 400, not 500" (`it.fails`).

- Title: List search treats % and _ as wildcards
  Severity: Low
  Suspected layer: Backend (`q` goes to Prisma `contains`, which does not escape LIKE wildcards)
  Steps to reproduce: 1. Create brand "Plain 1". 2. `GET /brands?q=%` or `?q=_`.
  Expected: only rows that contain a literal `%` or `_`.
  Actual: every brand matches.
  Evidence: `tenancy-qa.int-spec.ts` "q treats % and _ as literal characters" (`it.fails`). No cross-tenant exposure (still tenant-scoped); search quality only.

**Observations (not bugs; for Minhaj):**
1. The web production guard only fails the build for `VERCEL_ENV=production`. A production build elsewhere with `NEXT_PUBLIC_DEV_TENANT_ENABLED=true` would ship the switcher (the API still ignores the header in production). Fine while hosting is Vercel; revisit if hosting changes.
2. The dev-tenant header name `x-tenant-id` and the localStorage key remain as strings in the production bundle (inert; verified no header is sent).
3. Names that differ only by zero-width characters or by internal double spaces are different names (Rabbi already noted the whitespace case). Requirement gap if visually identical duplicates must be refused.
4. `timezone: 'asia/dhaka'` (lower-case) is accepted and stored as typed; harmless.
5. The real-API Playwright specs leave deactivated demo-tenant rows on the test branch (11 brands, 8 locations now); no cleanup path exists because there is no DELETE. Test-branch growth only.
6. `ALLOW_DEV_TENANT_HEADER=` (empty) stops the API at boot; unset is fine.
7. QA changed nothing in application code. QA touched demo data on the test branch twice (a brand and a legal-entity edit on demo tenants); both were restored/deactivated.

## Bugs (Minhaj triage)

| ID | Title | Layer | Assigned to | Fix notes | Status |
|---|---|---|---|---|---|
| BUG-004 | NUL characters in free text return 500 | Backend | Codex (Rabbi role) | Shared NoNul validator covers names, legal identifiers, addresses and search; nullable optional fields remain clearable | Closed (QA verified) |
| BUG-005 | Null timezone/locale settings return 500 | Backend | Codex (Rabbi role) | Non-nullable optional settings validate every supplied value, including null; omitted values remain valid | Closed (QA verified) |
| BUG-006 | Crafted pagination cursor returns 500 | Backend | Codex (Rabbi role) | Decoded UUID and NUL-free name validated before querying; old unit fixtures corrected to UUIDs | Closed (QA verified) |
| BUG-007 | Search treats percent/underscore as wildcards | Backend | Codex (Rabbi role) | Escape backslash, percent and underscore; real database regressions verify both matching and exclusion | Closed (QA verified) |

### Resume triage (Codex, Minhaj role, 2026-10-12)

Resumed from Tanvir's completed QA report. All four findings are backend validation/search defects under the existing approved requirements, not new business policy. Assigned to Codex in the Rabbi role on `codex/FEAT-001-backend`. Preserve the existing QA automation and convert its expected-failure regressions into ordinary passing tests after fixes. FEAT-031 remains assigned separately; no changes to its scope or implementation in this bug-fix work.

### Retest and closure (Tanvir QA agent / Codex Minhaj role, 2026-10-12)

Independent retest verified BUG-004..007 with no additional defects. All four expected-failure cases are now ordinary passing regressions. Added HTTP validation cases for legal/address text and nullable settings; real database literal-search checks cover both brands and locations, including backslashes and case-insensitivity. Corrected a flaky QA assertion to search the full unique attempted name rather than `q='T '`, which trims to `T` and can match unrelated generated test codes.

| Check | Result |
|---|---|
| `pnpm turbo run lint typecheck build test --output-logs=errors-only` | 15/15 tasks pass; API 322 unit tests, DB 16 unit tests |
| Independent `pnpm --filter api test:unit` | 322 passed (18 files) |
| Independent `pnpm --filter api test:integration` | 127 passed (6 files), no expected failures; guarded Neon test branch only |
| `NEXT_PUBLIC_API_URL=http://localhost:3011 E2E_PORT=3111 pnpm --filter web test:e2e` | 54 passed, 0 skipped; existing dev servers untouched |
| `pnpm format:check`, `git diff --check` | Pass |

AC-5 through AC-9 and AC-12 now PASS; AC-16/17 browser regressions PASS; AC-18 command set PASS. Remaining criteria retain their original passing evidence above. All 18 criteria are satisfied, all bugs closed, and FEAT-001 is closed. Existing MaxListeners warnings in concurrent HTTP tests remain non-failing observations.
