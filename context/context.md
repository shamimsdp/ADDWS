# Project context

Last updated: 2026-10-12 (Asia/Dhaka).

## Confirmed direction

- Build a SaaS product for multiple clothing brands.
- First release must support store retail and automated online integrations.
- Bangladesh is the initial market described by the supplied research.
- Implementation includes FEAT-000 setup, FEAT-001 tenancy/organization and FEAT-031 integration framework, all closed. The confirmed stack and team pipeline live in `CLAUDE.md`; current delivery status is in `progress-tracker.md` and the generated `feature-queue.md`.

## Source documents

- [Product specification](../clothing_inventory_management_software_product_spec.md): broad feature catalog, apparel domain, ledger principle, phased AI roadmap. Useful requirements inventory; too broad to treat as a committed backlog.
- [Compass research](../compass_artifact_wf-61486a1a-5bb3-5d45-9fe1-772eee0072b2_text_markdown.md): strongest emphasis on store/social commerce, couriers, COD, local tax documents and production/CMT. Its MVP spans too many domains for an unqualified delivery commitment.
- [Deep research](../deep-research-report.md): strongest architecture, forecasting-data and delivery-risk discussion. Recommends a modular monolith and postponing advanced AI.
- [Research PDF](../Research-inventory-management-system.pdf): 29 image-only pages reviewed through OCR, with a visual check of a clipped table. Appears to reproduce the Compass report rather than add independent evidence. Prefer the Markdown for complete tables and source links.

## Shared findings

All research supports apparel-specific style/color/size inventory, multi-location stock, purchasing/receiving, POS, exchanges, merchandising metrics and later decision intelligence. Inventory accuracy and clean availability history are prerequisites for credible AI.

## Disagreements and evidence limitations

- Compass places social integrations, several couriers, accounting features, mobile apps and an AI assistant in MVP; the other reports defer more of these. Our confirmed first release includes automated online operations, but provider count and depth need bounds.
- Pricing proposals vary materially. Treat them as experiments, not approved prices.
- Claims that no competitor combines these capabilities are hypotheses; missing public feature descriptions do not establish absence.
- Deep research citations contain unresolved session reference IDs and link to a larger specification not present in this workspace.
- Competitor prices, provider availability, market statistics and tax assertions have not been independently reverified in this task.
- Do not hard-code the apparel VAT rate quoted in the research or claim NBR certification from document generation alone.
- Effort/cost figures are source-author estimates with unknown staffing assumptions, not a project budget.

## Planning assumptions awaiting confirmation

Start with growing brands, a central warehouse and several outlets. Use one ecommerce connector and one courier integration in the first release, selected from pilot demand. Include manual social order entry; automated social-message capture is a separate provider-dependent capability.

Unresolved: pilot size/volume, ecommerce platform, courier, payment provider, offline policy, required hardware, tax obligations, budget and target date. Stack and team are confirmed in the progress tracker. Next implementation prerequisite is the FEAT-002 authentication requirement review.

## Context map

Read [project overview](project-overview.md), [architecture](architecture.md), [build plan](build-plan.md) and [progress tracker](progress-tracker.md) first. The remaining files govern delivery, code, UI and documentation practices. These files describe a proposed system unless explicitly marked confirmed or implemented.
