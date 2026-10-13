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
