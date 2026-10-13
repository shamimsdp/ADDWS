# Inventory management system

Project context lives in `context/`. Read `context/project-overview.md` and `context/progress-tracker.md` first.

## Stack

pnpm + Turborepo monorepo: `apps/api` (NestJS, Prisma, Better Auth, PostgreSQL on Neon, Vitest), `apps/web` (Next.js App Router, Tailwind, Playwright), `packages/db` (Prisma schema/migrations), `packages/shared` (API DTO types).

## Team agents (`.claude/agents/`)

| Agent | Person | Role | Model |
|---|---|---|---|
| `minhaj-project-manager` | Minhaj | Project queries, task distribution, progress, bug triage | sonnet |
| `rabbi-backend-developer` | Rabbi | Database, backend logic, backend unit tests | sonnet |
| `shamim-frontend-developer` | Shamim | Frontend, Playwright tests | sonnet |
| `tanvir-qa-automation` | Tanvir | Full-feature QA: unit + Playwright, bug reports | sonnet |

## Lean delivery pipeline

The main session coordinates and handles planning, documentation and routine fixes directly. Do not start every specialist by default. Minhaj selects one lane during requirement review:

| Lane | Use when | Execution |
|---|---|---|
| Fast | Documentation, copy, styling, test selectors, isolated low-risk fixes | Main session or one specialist; targeted checks; no separate QA agent |
| Standard | A normal feature with meaningful work in one or two layers | Only the required implementer(s), then one independent QA pass after code freeze |
| Deep | Authentication, authorization, tenant isolation, migrations, payments, inventory posting, concurrency or destructive data behavior | Required specialists plus independent QA; full regression once after code freeze |

1. Minhaj runs `node scripts/feature-queue.mjs`, reviews the next feature and records its lane, scope and acceptance criteria. Ask only for unresolved business policy.
2. Assign only layers with real implementation work. Backend-only work skips Shamim; frontend-only work skips Rabbi; fast work stays in the main session when practical.
3. Implementers run targeted tests for changed behavior plus their scoped lint/type/build checks. They do not run the complete repository or browser suite unless they are the designated final verifier.
4. After implementation is frozen, Tanvir runs one proportionate independent pass. Full regression is required for Deep work and when shared behavior changed; Standard work uses affected suites plus acceptance checks.
5. A test-only fix reruns the failed test and affected group. Repeat the full suite only when application behavior, shared infrastructure or risk evidence justifies it.
6. Minhaj closes clean work and updates progress. Handoffs contain only outcome, contract changes, validation and unresolved risks.

Shared state: `context/feature-queue.md` (generated: done / next / per-role queues / build order), `context/feature-list.md` (all features/sub-features + dependencies), `context/feature-progress-list.md` (per-layer status), `context/task-board.md` (active pipeline + bugs) and `context/features/` (per-feature handoffs). Stop and ask the user when an agent returns `Agent: none` (business decision needed).

## Local agent dashboard

`pnpm agents:dashboard` serves http://127.0.0.1:4310. Hooks and the local Codex collector observe lifecycle and tool activity automatically without prompts or tool payloads. Do not spend model turns on heartbeat or routine status reports. Use `pnpm agents:report` only for a meaningful handoff or when automatic collection is unavailable. See `tools/agent-dashboard/README.md`.
