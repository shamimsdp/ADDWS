# Inventory management system — instructions for Codex

This repo is worked on by **Claude Code and Codex in parallel**. `CLAUDE.md` is the shared source of truth for stack, team roles and pipeline; read it first. Everything below applies to Codex.

## Roles

The team is defined in `.claude/agents/`. When asked to act as a team member, read that file fully and follow it exactly (responsibilities, stack rules, handoff steps, `NEXT STEP` output):

| Say | Role file |
|---|---|
| "act as Minhaj" | `.claude/agents/minhaj-project-manager.md` |
| "act as Rabbi" | `.claude/agents/rabbi-backend-developer.md` |
| "act as Shamim" | `.claude/agents/shamim-frontend-developer.md` |
| "act as Tanvir" | `.claude/agents/tanvir-qa-automation.md` |

Skills mentioned in those files (e.g. `better-auth-best-practices`) are Claude Code skills; Codex should use the official Better Auth docs instead.

## Rules for working in parallel

1. **Only work on assigned items.** Pick work from `context/feature-queue.md` (regenerate with `node scripts/feature-queue.mjs`) and only items Minhaj has assigned in `context/task-board.md`. Never start a sub-feature without `Requirements approved: yes` in its feature file.
2. **Claim before you start.** In `context/feature-progress-list.md` set your layer column to `In progress` and the Updated column to `<date> Codex`. If the row already shows `In progress` by someone else, stop and pick something else.
3. **One tool per sub-feature layer.** Claude and Codex must never work on the same sub-feature layer at the same time. Splitting by layer (e.g. Claude = backend of FEAT-006, Codex = frontend of FEAT-005) or by independent features in the same wave of the build order is fine.
4. **Separate git worktrees/branches.** Each tool works on its own branch (`codex/FEAT-XXX-<layer>`, `claude/FEAT-XXX-<layer>`), ideally in its own git worktree. Merge through review; never force-push the other tool's branch.
5. **Shared files: small, fast edits only.** `context/feature-progress-list.md`, `context/task-board.md` and `context/features/*.md` are shared. Re-read immediately before editing, change only your own rows/sections, save, and do not reformat other content.
6. **Never edit `context/feature-queue.md` by hand** — it is generated.
7. **Requirements belong to Minhaj.** If you hit a requirement gap, stop and report it; do not decide business behaviour.
8. Never commit `.env` files or print secrets/connection strings. DB-backed tests run only against the Neon test branch.

## Live developer dashboard

Run `pnpm agents:dashboard` to view http://127.0.0.1:4310. Before role work, report `active` with a stable, unique session ID: `pnpm agents:report --agent <minhaj|rabbi|shamim|tanvir> --source codex --session <task-session> --status active --feature FEAT-XXX --task "Short task summary"`. Refresh activity at meaningful milestones; use `--run -- <executable> <args>` for heartbeat reporting during long commands. Before yielding, report `completed`, `waiting` or `failed` for the same session; use `--to <agent>` for handoffs. Report actual role/activity only; do not invent progress. Never include secrets, prompts or raw command output. Details: `tools/agent-dashboard/README.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
