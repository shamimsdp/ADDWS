# Local agent dashboard

Run from the repository:

```sh
pnpm agents:dashboard
```

Open **http://127.0.0.1:4310**. Set `AGENT_DASHBOARD_PORT` for a different port. This standalone developer tool uses Node only, no database, model API or customer application. The browser is read-only; no remote telemetry service is used.

## What is live

Four illustrated role avatars represent Minhaj, Rabbi, Shamim and Tanvir. Live cards are derived from runtime reports, not assigned tasks. Event updates arrive through SSE within about a second. An active/waiting session without a report for two minutes becomes **stale** (last known activity, not proof of a running agent). Disconnected browser streams show a connection warning and reconnect automatically.

Assignments, completion totals and the next queue read the current checkout's `context/` documents. Runtime events are shared between Git worktrees under the Git common directory's `agent-dashboard/events`. Without Git, `.agent-dashboard/` is ignored by source control. `AGENT_DASHBOARD_DATA_DIR` overrides event storage for tests or a separate local session.

## Claude Code

The tracked `.claude/settings.json` installs metadata-only lifecycle hooks. Start a new Claude session, or review/reload the hooks using Claude's `/hooks` interface. Named project subagents map to their role cards. Unknown subagents are ignored. Main Claude coordination maps to Minhaj unless an explicit project agent type is present.

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

## Interactive observatory

The central portrait follows the most recently reporting active/waiting agent. Choose a portrait or team card to pin an agent; choose a session to inspect concurrent work. Follow live resumes automatic selection. Pause motion freezes decorative animation without interrupting live data; reduced-motion preferences are respected.

Activity stations light up from action metadata: Read → reading, Edit/Write → coding, Grep/Glob → searching, Bash → running commands. The Codex collector also recognizes file-read, search and test commands. Tool completion returns to unspecified working. Thinking comes from phase metadata without reading reasoning content; task titles never imply current activity. Waiting, stale, completed, failed and disconnected states stop activity animation.

Explicit reporting remains available for task summaries or when automatic collection is unavailable. Use actions such as `--action "Reading files"`, `--action "Writing code"`, `--action "Running tests"` or `--action "Thinking about the approach"`. Private reasoning, raw file contents and shell commands are not collected.
