# Local agent dashboard

Run from the repository:

```sh
pnpm agents:dashboard
```

Open **http://127.0.0.1:4310**. Set `AGENT_DASHBOARD_PORT` for a different port. This standalone developer tool uses Node only, no database, model API or customer application. The browser is read-only; no remote telemetry service is used.

## What is live

Five illustrated role avatars represent Minhaj, Rabbi, Shamim, Tanvir and Nadia (CR manager). Nadia works beside the delivery pipeline, so she has a team card and stage portrait but no pipeline step. Live cards are derived from runtime reports, not assigned tasks. Event updates arrive through SSE within about a second. An active/waiting session without a report for two minutes becomes **stale** (last known activity, not proof of a running agent). Disconnected browser streams show a connection warning and reconnect automatically.

Assignments, completion totals and the next queue read the current checkout's `context/` documents. Runtime events are shared between Git worktrees under the Git common directory's `agent-dashboard/events`. Without Git, `.agent-dashboard/` is ignored by source control. `AGENT_DASHBOARD_DATA_DIR` overrides event storage for tests or a separate local session.

## WBS page

**http://127.0.0.1:4310/wbs** shows the full `context/feature-progress-list.md` as a work breakdown structure: stage → feature → sub-feature with overall and per-layer status, bugs, and every hour-estimate column. Totals show done sub-features, agent hours and human review hours (all / remaining), and blocked / awaiting-review counts. Filter by stage, status (including *Awaiting human review*) or text search. The page follows `context/delivery-config.json`: in `fully-agentic` mode only agent estimate columns exist and the human metric is hidden. It re-reads the tracker every 5 seconds through the read-only `/api/wbs` endpoint.

## Claude Code

The tracked `.claude/settings.json` installs metadata-only lifecycle hooks. Start a new Claude session, or review/reload the hooks using Claude's `/hooks` interface. Named project subagents map to their role cards. Unknown subagents are ignored. The main session (the Claude or Codex session you are talking to) is recorded as a separate coordinator, never as Minhaj or any team card. Minhaj appears only while the `minhaj-project-manager` agent runs (use `pnpm agents:report --agent minhaj` for manual reporting).

## Is the agentic workflow running?

The chip in the observatory heading answers it. **Agentic workflow running · Rabbi, Tanvir** (cyan, pulsing) means named agents are active or waiting. **Main session only · no agents dispatched** (amber) means work is happening, but only in the coordinating session. **Idle · no active work** means nothing has reported recently. Sessions that stop reporting for two minutes stop counting as running. If the chip says main session only while you expected agents, nothing dispatched them: ask for the agent explicitly (for example Minhaj for requirement review) or follow the pipeline in `CLAUDE.md`.

Hooks record lifecycle/tool names and identities only. They never store hook input, prompts, transcripts, command arguments, tool output or credential values. Hook failures do not block Claude. Supported schema reference: [official Claude hooks](https://code.claude.com/docs/en/hooks), verified 2026-10-12. Long reasoning/tool calls can legitimately become stale until the next hook event; the command wrapper below provides regular heartbeats for long commands.

## Automatic Codex activity

Starting the dashboard automatically observes local Codex session records under `~/.codex/sessions`, restricted to this repository and its Git worktrees. The collector status above the team shows connection, matched session count and the last observed activity. It follows tool starts/completions, thinking-phase metadata and turn completion without manual stage reports. File byte offsets detect appends even when modification timestamps remain frozen. Historical records retain their original timestamps; a watcher poll alone never makes a session look active.

Only fixed activity labels, role/thread identity and event timestamps are copied into telemetry. Prompts, reasoning contents, commands, tool results and transcript paths are never persisted or served. Unknown subagents are ignored; use role-prefixed task names such as `rabbi_auth_backend` to map project workers. This is a local record adapter rather than an OpenAI API subscription. Local record formats can change; missing/unreadable records are shown as unavailable and explicit reporting remains supported. Official [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) describes native lifecycle hooks and notes that transcript formats are not stable interfaces (checked 2026-10-12).

## Explicit role/task reporting

Use the CLI for meaningful task summaries and handoffs, or when local Codex records are unavailable. Keep the same session ID for a task and use a distinct one for simultaneous agents.

```sh
pnpm agents:report --agent rabbi --source codex --session backend-046 --status active --feature FEAT-046 --task "Implement activity telemetry"
pnpm agents:report --agent rabbi --source codex --session backend-046 --status active --action "Backend checks passed"
pnpm agents:report --agent rabbi --source codex --session backend-046 --status completed --to shamim --action "Frontend handoff ready"
```

Statuses: `active`, `waiting`, `idle`, `completed`, `failed`. No report means no observed live session. Explicit reporting has no automatic inference of typing or thinking. Use only non-sensitive task summaries.

Wrap a long command to emit real heartbeats every 15 seconds and record success/failure automatically:

```sh
pnpm agents:report --agent tanvir --source codex --session qa-046 --task "Dashboard verification" --run -- node --test tools/agent-dashboard/store.test.mjs
```

The wrapper runs a command directly, without a shell. On Windows, use `node` or a real executable; for pnpm commands use `cmd.exe /d /c pnpm ...` explicitly if needed. Full commands and command output never enter telemetry.

## Verification

```sh
pnpm agents:test
```

Browser checks reuse the project's existing Playwright dependency and Chromium. On a fresh checkout, install project dependencies and run `pnpm --filter web exec playwright install chromium` first. Tests use temporary local telemetry and never access the application database.

Avatars live in `public/avatars/` and can be edited as SVG assets. There are no portrait uploads or external asset requests.

## Real agent photos

Drop a photo into `tools/agent-dashboard/public/avatars/` named after the agent: `minhaj`, `rabbi`, `shamim`, `tanvir` or `nadia` with a `.jpg`, `.jpeg`, `.png` or `.webp` extension (for example `rabbi.jpg`). It replaces the illustrated avatar everywhere on the next page load, with no restart. Photos are cropped to a circle from the top center, so a square head-and-shoulders shot works best. A missing or unreadable photo falls back to the illustration. Photos are served only from this folder, only for these five names and only as images, and stay on this machine unless you commit them.

## Interactive observatory

The observatory at the top of the page shows the five agents as a row of thumbnails; each glows in its own color while working and shows its current activity (waiting amber, failed red, idle dim). Below, the focused agent sits in a center circle, ringed by the six work options: Thinking, Reading files, Searching, Writing code, Running commands and Testing. The option the agent is currently doing lights up and sends glowing pulses along an animated line into the center agent. Choose a thumbnail to pin that agent to the center; Follow live returns to the most recently active agent. The theme lives in `public/theme.css`.


The central portrait follows the most recently reporting active/waiting agent. Choose a portrait or team card to pin an agent; choose a session to inspect concurrent work. Follow live resumes automatic selection. Pause motion freezes decorative animation without interrupting live data; reduced-motion preferences are respected.

Activity stations light up from action metadata: Read → reading, Edit/Write → coding, Grep/Glob → searching, Bash → running commands. The Codex collector also recognizes file-read, search and test commands. Tool completion returns to unspecified working. Thinking comes from phase metadata without reading reasoning content; task titles never imply current activity. Waiting, stale, completed, failed and disconnected states stop activity animation.

Explicit reporting remains available for task summaries or when automatic collection is unavailable. Use actions such as `--action "Reading files"`, `--action "Writing code"`, `--action "Running tests"` or `--action "Thinking about the approach"`. Private reasoning, raw file contents and shell commands are not collected.
