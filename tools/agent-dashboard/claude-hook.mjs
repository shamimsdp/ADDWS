import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentId, dataDirectory, report } from './store.mjs';

export function hookEvent(input) {
  const type = input.hook_event_name;
  // Named project agents map to their cards. The main session (no agent id) is recorded as the
  // coordinator, never as Minhaj; other subagents are ignored.
  const agent = agentId(input.agent_type) ?? (input.agent_id ? null : 'main');
  if (!agent || typeof input.session_id !== 'string') return null;
  const status = {
    SessionStart: 'idle',
    UserPromptSubmit: 'active',
    PreToolUse: 'active',
    PostToolUse: 'active',
    PostToolUseFailure: 'active',
    SubagentStart: 'active',
    SubagentStop: 'completed',
    Stop: 'idle',
    SessionEnd: 'completed',
    PermissionRequest: 'waiting',
    Notification: 'waiting',
    StopFailure: 'failed',
  }[type];
  if (!status) return null;
  return {
    agent,
    source: 'claude',
    sessionId: `${input.session_id}/${input.agent_id ?? 'main'}`,
    status,
    // Raw hook input, prompt, commands, tool output and transcript paths are never persisted.
    task: agent === 'main' ? 'Main session' : `${agent} agent session`,
    action:
      type === 'PreToolUse'
        ? `Using ${String(input.tool_name ?? 'tool')
            .replace(/[^a-zA-Z0-9_.:-]/g, '')
            .slice(0, 60)}`
        : type.replace(/([a-z])([A-Z])/g, '$1 $2'),
    cwd: typeof input.cwd === 'string' ? input.cwd : '',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Observability must never block Claude's actual work.
  try {
    let text = '';
    for await (const chunk of process.stdin) {
      text += chunk;
      if (text.length > 1_048_576) process.exit(0);
    }
    const input = JSON.parse(text);
    const event = hookEvent(input);
    if (event) {
      const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
      await report(dataDirectory(root), event);
    }
  } catch {
    /* fail open: hooks emit no output and cannot interrupt a session */
  }
}
