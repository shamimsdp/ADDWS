# FEAT-046 Local agent dashboard

Status: Done (2026-10-12)

## Requirement review (Minhaj)

User explicitly requested a local developer dashboard and avatars for each agent. Existing team: Minhaj, Rabbi, Shamim and Tanvir. FEAT-000 is Done. No new business-policy gap: no customer data, accounts, deployments, model API calls or database changes.

Sources: user request, CLAUDE.md, AGENTS.md, task board, feature/progress lists and official Claude hook reference https://code.claude.com/docs/en/hooks (accessed 2026-10-12).

Routine choices: standalone buildless dashboard served by Node on 127.0.0.1:4310; local event files in Git common directory so linked worktrees share activity; distinct repo-native SVG avatars; read-only web UI; lifecycle reporting with per-session identity, explicit stale state and separate assignment data. Claude hooks record only allowlisted metadata, never prompts, tool input/output or transcripts. Codex uses explicit reporting and a command wrapper; there is no claim of direct runtime access to this chat's internal events.

**Requirements approved: yes — 2026-10-12.** User authorization covers the requested local dashboard and avatars; choices above are reversible implementation details.

## Assignment

- AC-1: One command opens a loopback-only dashboard without database or extra dependencies.
- AC-2: Four named agents have distinct avatars, roles, statuses and current tasks; assignments alone never imply runtime activity.
- AC-3: Event reporting updates the page through SSE; loss of reporting becomes stale and disconnected clients see a connection warning.
- AC-4: Concurrent agent sessions and worktrees retain separate identities; completion of one session does not hide another active session.
- AC-5: Timeline, role/status filters, pipeline/queue and detail panel work on desktop and mobile, with keyboard-accessible controls.
- AC-6: Claude hooks consume supported lifecycle metadata; Codex reporting and command wrapper support start/heartbeat/completion/failure and handoff events.
- AC-7: No secrets or raw prompts/commands/transcripts are stored or served; arbitrary local files are not exposed; browser access is read-only.
- AC-8: Automated checks cover telemetry transitions/concurrency, hook parsing/privacy, server access boundary and browser live updates.

Root/Codex (Rabbi role): telemetry, server, runtime adapters, regression tests, docs. Shamim: isolated static UI and avatars, browser checks. Tanvir: independent verification. Keep this tool outside apps/web and apps/api so it is never deployed as a customer feature.

## Backend handoff

Early contract available for frontend: standalone Node server `tools/agent-dashboard/server.mjs`, loopback port 4310, read-only `GET /api/snapshot` and SSE `GET /api/events` (default message data = snapshot JSON). Static allowlist: `/`, `/app.js`, `/styles.css`, `/avatars/{minhaj,rabbi,shamim,tanvir}.svg`, served from `tools/agent-dashboard/public/`.

Snapshot: `{project, generatedAt, staleAfterMs, agents, events, totals, assignments, next}`. Agent: `{id,name,role,specialty,color,status,current,sessions,lastSeen}`. Status includes active/waiting/idle/completed/failed/stale. Current/session: `{id,at,sessionId,source,status,kind,task,action,feature,handoffTo,worktree,startedAt}`. Events are newest-first, excluding heartbeats, at most 100. Totals: `{total,done,blocked,inProgress}`. Assignment: `{id,title,status,owner,agent}`; runtime activity is independent. Next: `{id,title,priority,unlocks}`.

Reporting CLI and Claude adapter implemented. Nine Node tests pass: concurrent writers/session isolation, stale/heartbeat transitions, metadata privacy, hook mapping, assignment/runtime separation, host/origin/read-only boundaries, actual SSE updates and corrupt-event resilience. Scoped Node ESLint passes. No application/database dependencies.

Claude Code installed version is 2.1.287. Tracked hooks use official supported command/args input and named SubagentStart/Stop events. CLI command wrapper emits 15-second heartbeats and captures success/failure with no raw command payload. Further independent QA/browser verification pending.

## Frontend handoff

Completed `tools/agent-dashboard/public/` (index.html, app.js, styles.css and four SVG role avatars). Stable live cards preserve keyboard focus across updates. Includes role/status filters, concurrent-session details, activity/handoff timeline, assigned-task separation, pipeline, project work-item counts and next queue. Explicit no-telemetry, disconnected/retry and empty-filter states; event text uses textContent. All assets are local.

Frontend checks: scoped ESLint and Node syntax pass; HTML/JS/CSS formatting pass. Browser smoke verifies four cards, actual CLI/SSE activity updates, filters, details/close, retained focus, no browser errors and no horizontal overflow at 320/375/768 px. Desktop/mobile screenshots saved locally under ignored `.agent-dashboard/screenshots/`. Independent QA follows.

## QA report

Independent Tanvir QA: `pnpm agents:test` passes **22/22** checks: 15 Node/CLI/store tests and seven Chromium browser tests. Scoped ESLint, Prettier and whitespace checks pass. Actual 15-second heartbeat was verified with a running command. Browser tests use a fresh loopback server and isolated synthetic telemetry; actual project activity is not fabricated. No database accessed or customer application changed.

All AC-1..8 PASS: local read-only server; four avatars and observed-runtime cards; SSE/disconnect/stale behavior; source/session concurrency and preservation; filters/details/keyboard/mobile; Claude hook and Codex reporter/command wrapper; allowlisted metadata and loopback/path boundaries; automated verification. Root also checked the linked worktree `D:/app/ims-feat-031` resolves to the same Git common telemetry directory. No open bugs.

Preview server used for screenshots is stopped at delivery; start the local tool with `pnpm agents:dashboard`. Claude hooks apply to new/reloaded sessions. Codex reporting remains explicit through the documented workflow, not a direct private-runtime API subscription. No pricing/token usage is inferred.

## Interactive observatory follow-up (2026-10-12)

User requested a central visible avatar and clearer thinking/reading/coding activity, providing three radial agent diagrams as visual references. Requirements approved: yes, within the existing local developer dashboard scope.

Implemented a central portrait with orbit and action cues, six activity stations, live-follow/pinned-agent modes, concurrent-session selection and a motion toggle. Tool metadata identifies reading, editing, discovery and command execution. Thinking/planning and testing require explicit action reports; task descriptions never imply execution. Terminal, waiting, stale and disconnected states stop activity motion. Reduced-motion preferences disable animation. Existing cards, filters, details, timeline and project tracker remain functional.

Validation: 25 automated checks pass, including eight Chromium browser checks and two activity classification checks. Scoped ESLint and whitespace checks pass. Desktop and mobile screenshots were inspected using isolated preview telemetry; preview server stopped after capture. Customer applications and databases were not changed.

## Automatic runtime follow-up (2026-10-12)

User reported the observatory remained static during actual Codex work. The page's SSE was live, but explicit milestone reports left long gaps. Added a local Codex collector that reads workspace/worktree-scoped lifecycle and tool metadata automatically, preserves original event times and follows file byte offsets rather than unreliable modification times. Only sanitized fixed labels and identities are persisted; transcript contents are never served. A visible collector indicator distinguishes automatic observation from the browser/server connection. The record adapter is local and may need updates if Codex changes its format; explicit reports remain available.

Validation: 33 tests pass, including nine Chromium browser checks and seven collector checks. The end-to-end collector browser test appends runtime records and verifies avatar transitions without manual reporter calls. Actual local smoke detected seven distinct project sessions, including the active authentication backend; child thread IDs remain distinct despite shared parent session IDs. The user's existing dashboard server was restarted at port 4310 with automatic observation enabled.
