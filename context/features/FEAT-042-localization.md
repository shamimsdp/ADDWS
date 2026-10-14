# FEAT-042: Localization

Status: Requirements approved 2026-10-14 (human: user); Todo - not yet scheduled

## Requirement review (Minhaj)

**Sub-features:** FEAT-042.1 Bangla / English UI, FEAT-042.2 BDT currency and number formatting, FEAT-042.3 Business timezone and dates

**Dependencies done:** FEAT-000.5 (web skeleton) Done. Also relies on FEAT-001.5 tenant settings (Done): `tenant_settings.currency_code` (BDT, immutable), `business_timezone` (default Asia/Dhaka), `default_locale` (`en|bn`) and `locations.timezone` already exist, so no migration is expected.

**Existing implementation (evidence):** `apps/web/src/i18n/index.ts` has `t(key, params, locale)` with `Locale = 'en'` only; catalogs `messages.en.ts`, `messages.auth.en.ts`, `messages.integrations.en.ts`; 49 web files already use `t()`. No Bangla catalog, no locale provider or switcher. Raw `new Date(...).toLocaleString()` appears in 4 places in `components/auth` (browser locale and timezone, which breaks the business-timezone rule). Server: `apps/api/src/common/time/business-date.ts` (Asia/Dhaka default, IANA validation, `businessDate()`), `common/money/money.ts` (2-decimal Decimal rounding, plain `formatMoney`). No web currency/number formatter exists.

**Sources checked:** `feature-list.md`, `project-overview.md` (Bangladesh-first), `ui-rules.md` ("support English/Bangla layout and BDT formatting without hard-coding text"), `ui-tokens.md` (fonts with English/Bangla coverage, tabular numbers, verify printer rendering), `architecture.md` and `code-standards.md` (UTC instants plus business timezone context; Decimal money), `features/FEAT-001` (BDT only, business date rule), research spec (Bangladesh-first).

**Gap checklist:**
- [x] User roles and permissions: changing tenant default locale/timezone stays with the existing settings permission (owner/admin interim). Any user may choose their own display language (Q1).
- [x] Business rules and policies: language scope (Q1), digits and currency display (Q2), grouping (Q3), timezone change (Q4), translation quality (Q5), date format (Q6).
- [x] Data fields, validation, uniqueness: reuse `default_locale` (en|bn) and `business_timezone`. A per-user preference stored server-side would need a user column; proposed answer avoids one.
- [x] States and transitions: switch applies without reload; a missing Bangla key falls back to English (never a raw key); TypeScript requires the bn catalog to contain every key.
- [x] Failure, edge and concurrency cases: untranslated fallback; long Bangla strings in buttons and tables; product names stay as entered; invalid stored timezone falls back to Asia/Dhaka and logs.
- [x] Tenant and location scope: locale and timezone are tenant-wide; the existing location timezone overrides for location documents.
- [x] Money / tax / timezone: BDT only; API keeps 2-decimal Decimal strings, formatting only at display; instants UTC, shown in business timezone; document/report dates use the business date helper.
- [x] Audit needs: none beyond existing settings update logging.
- [x] UI screens and flows: language switcher in header, tenant default in Organization settings (`settings-tab.tsx`); Bangla font via `next/font` with fallback; checked at mobile and desktop widths; update `ui-registry.md`.
- [x] Integrations: none now; later exports/receipts (FEAT-028/041) reuse the formatters. Thermal-printer Bangla rendering is a FEAT-028 check (flagged).
- [x] Open decisions: none formal.

**Gaps found:**

| # | Gap | Type (Routine / Business) | Proposed answer | Final answer | Decided by |
|---|---|---|---|---|---|
| R1 | Where formatters live | Routine | Web: `src/i18n/format.ts` (`formatMoney`, `formatNumber`, `formatDate`, `formatDateTime`) using `Intl` with active locale and tenant timezone; API returns raw values; constants in `@ims/shared` | as proposed | Minhaj |
| R2 | Locale routing | Routine | No `/bn` URL prefix; locale from user cookie else tenant `default_locale`; `<html lang>` follows | as proposed | Minhaj |
| R3 | Raw `toLocaleString()` | Routine | Replace the 4 auth usages with the business-timezone formatter; add a lint/test guard against new raw usages | as proposed | Minhaj |
| R4 | Bangla font | Routine | Noto Sans Bengali via `next/font` (self-hosted), tabular figures | as proposed | Minhaj |
| R5 | Translation source | Routine | Agent drafts Bangla for all existing keys; keys stay English-first | as proposed | Minhaj |
| Q1 | Language choice scope | Business | Tenant default language (existing setting) plus each user can override for themselves, stored in a browser cookie (no new database field) | as proposed (accepted) | user, 2026-10-14 |
| Q2 | Currency display and digits | Business | "৳ 1,250.00" in both languages; digits follow the language (Bangla digits in Bangla UI) except barcodes, SKUs, document numbers, phone numbers and CSV/exports, which always stay Latin digits | as proposed (accepted) | user, 2026-10-14 |
| Q3 | Number grouping | Business | Bangladesh grouping (lakh/crore: 12,50,000) in both languages | as proposed (accepted) | user, 2026-10-14 |
| Q4 | Changing business timezone later | Business | Allowed for owner/admin with a warning; already-posted documents keep their business date; only new documents use the new timezone | as proposed (accepted) | user, 2026-10-14 |
| Q5 | Bangla translation review | Business | Agent drafts; a Bangla-fluent person on the client side reviews wording before pilot; a small glossary (SKU, variant, stock) is agreed once | as proposed (accepted) | user, 2026-10-14 |
| Q6 | Date and time format | Business | dd/mm/yyyy in both languages, 12-hour time with am/pm | as proposed (accepted) | user, 2026-10-14 |

**Estimates:** 042.1 5.75 agent h, 042.2 4.75, 042.3 4.75 = 15.25 agent h; human verify 5.5 h.

**Requirements approved:** yes (human: user, 2026-10-14)

## Assignment (Minhaj)

**Execution lane:** Standard

**Why this lane / final verifier:** Mostly frontend plus small shared/helper backend work; no migration, tenant-isolation or stock logic. Layers: Shamim (main), Rabbi (042.2/042.3 helpers and settings validation). One independent QA pass (Tanvir) with Playwright language-switch and timezone specs.

**FINAL - approved by the human 2026-10-14.**

**User outcome:** Staff use the app in Bangla or English with BDT amounts, Bangladesh number grouping and business-timezone dates.

**Accepted policy:** tenant default language plus per-user cookie override; "৳ 1,250.00" with digits following the language, Latin digits for barcodes/SKUs/document and phone numbers and exports; lakh/crore grouping in both languages; dd/mm/yyyy with 12-hour am/pm; business timezone changeable by owner/admin with warning, posted documents keep their business date; agent drafts Bangla, client-side Bangla-fluent reviewer checks before pilot with a small glossary.
**In scope:** 042.1 bn catalog, locale provider/switcher, font; 042.2 `format.ts` money/number formatters; 042.3 date formatters, replace 4 raw `toLocaleString()` usages with a guard, timezone-change warning and validation.
**Out of scope:** `/bn` URL prefix, per-user DB field, thermal-printer Bangla rendering (FEAT-028 check), translating product data.
**Layers:** Shamim (main), Rabbi (042.2/042.3 helpers and settings validation), then Tanvir. **Lane:** Standard.
**Acceptance criteria:** language switch applies without reload and survives refresh; no raw keys shown (English fallback); every bn key present; 1250000 renders "12,50,000.00" with ৳; dates dd/mm/yyyy 12-hour in business timezone; Latin digits kept where specified; timezone change warns and does not alter existing documents.
**QA focus:** Playwright language-switch and timezone specs; long Bangla strings at mobile and desktop widths.
**Open item (non-blocking for build):** the client-side Bangla reviewer is not yet named; needed before pilot, not before implementation.
