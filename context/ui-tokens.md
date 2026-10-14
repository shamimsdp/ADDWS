# UI tokens

Status: proposed starting values, not implemented assets or an approved brand identity.

| Token family | Proposed values |
|---|---|
| Background | Canvas `#F8FAFC`; surface `#FFFFFF` |
| Text | Primary `#0F172A`; secondary `#475569` |
| Border | `#CBD5E1` |
| Action | Primary `#1D4ED8`; hover `#1E40AF`; on-primary `#FFFFFF` |
| Semantic | Success `#166534`; warning `#92400E`; danger `#B91C1C`; info `#1D4ED8` |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px |
| Radius | 4 px compact; 8 px control; 12 px panel |
| Type scale | 12 px label; 14 px table/body-small; 16 px body; 20/24/32 px headings |
| Control size | Default 40 px; touch/POS 48 px minimum proposal |

Use semantic names in implementation rather than raw values in individual components. Select fonts with reliable English/Bangla coverage and verify printer rendering. Use tabular numbers for quantities and money.

Verify contrast for each actual foreground/background pairing; this table does not establish accessibility compliance. Validate dense tables and touch checkout separately. Dark mode is undecided.

## FEAT-047 semantic extensions (implemented in `apps/web/src/app/globals.css`)

New names only; the values above are unchanged. Components use the utilities, never the hex values.

| Token | Value | Use | Pairing contrast (approx.) |
|---|---|---|---|
| `line-soft` | `#E2E8F0` | Card, table and divider borders (decorative) | n/a (decorative) |
| `control-line` | `#78869B` | Input/select borders (UI component boundary) | 3.6:1 on surface |
| `surface-muted` | `#F1F5F9` | Table header, skeleton, neutral chip, hover wash | ink-muted 6.9:1 |
| `action-soft` / `info-soft` | `#EFF4FF` | Active nav item, info chip/notice | action 6.1:1 |
| `success-soft` | `#ECFDF3` | Success chip/notice | success 6.9:1 |
| `warning-soft` | `#FFFBEB` | Warning chip/notice | warning 6.9:1 |
| `danger-soft` | `#FEF2F2` | Danger chip/notice | danger 5.9:1 |
| `brand-deep` | `#172554` | Auth brand panel gradient end | on-action 16:1 |
| Shadows | `shadow-card`, `shadow-raised`, `shadow-popover` | Card, auth card/hover, menus/drawer | n/a |
| Shell sizes | `sidebar` 256 px, `rail` 72 px, `header` 64 px, `target` 44 px | Sidebar, icon rail, header height, drawer/menu touch targets | n/a |
| Containers | `page` 80rem, `auth` 28rem, `auth-wide` 36rem | Page content max width, auth card widths | n/a |
| Radius | `card` 16 px, `pill` full | Large containers, chips | n/a |
| Type | `display` 36/44 px | Auth brand headline | n/a |

Chip and notice borders use the tone colour at low opacity (`border-success/25`). Reduced motion is honoured globally in the base layer.
