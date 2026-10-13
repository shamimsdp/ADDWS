# Project rules

1. Confirmed user decisions outrank assumptions in these documents. Keep decisions and proposals distinguishable.
2. First release serves multiple clothing brands and includes store retail plus automated online integrations.
3. Protect inventory correctness: immutable postings, atomic balance updates, explicit reservations, reversals and idempotency.
4. Enforce tenant isolation and location permissions throughout APIs, jobs, reports, exports and integration callbacks.
5. Do not infer payment success from tender selection or courier delivery from booking.
6. Limit initial integrations to a reviewed provider set; avoid silently expanding the MVP.
7. Keep tax configuration effective-dated. Verify applicable requirements before compliance-dependent implementation.
8. Capture stock availability and historical price/cost data before predictive features.
9. AI starts with explanations/recommendations; purchasing, stock posting, refunds and pricing remain controlled business actions.
10. Prefer modular architecture and explicit workflows. Do not add microservices without a measured need.
11. Update context and progress after meaningful decisions or delivery. Never mark planned features implemented.
12. Prefer codebase-memory MCP for code discovery; index when code exists and is not indexed. Use file search for non-code documents/configuration or insufficient graph results.
13. Keep secrets and customer records out of source, fixtures and documentation.
14. Test high-risk business invariants, tenant boundaries and integration retries. Use proportionate verification for documentation and visual changes.
15. Default to the fewest agents needed. Use Fast, Standard and Deep lanes from `workflow.md`; only high-risk work requires the full specialist pipeline.
16. Run broad regression once after implementation freeze. During development and test-only repair, prefer targeted checks and affected suites.
17. Keep agent handoffs compact and evidence-based. Automatic dashboard observation must not create model-generated heartbeat work.
