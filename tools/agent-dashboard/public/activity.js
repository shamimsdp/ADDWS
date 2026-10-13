// Only reported action metadata is classified. Task descriptions are not execution evidence.
export function activityOf(session, disconnected = false) {
  if (disconnected) return 'disconnected';
  const status = session?.status ?? 'idle';
  if (status !== 'active') return status;
  const action = session.action ?? '';
  if (/^(reading(?: files?)?|using (?:read|readfile|get_code_snippet))\b/i.test(action))
    return 'reading';
  if (
    /^(writing(?: code)?|editing(?: files?)?|using (?:write|edit|multiedit|apply_patch))\b/i.test(
      action,
    )
  )
    return 'coding';
  if (
    /^(searching|using (?:grep|glob|search_graph|search_code|websearch|webfetch))\b/i.test(action)
  )
    return 'searching';
  if (/^(testing|running tests)\b/i.test(action)) return 'testing';
  if (/^(running(?: commands?)?|using (?:bash|exec_command|powershell))\b/i.test(action))
    return 'running';
  if (/^(thinking|planning|analyzing)\b/i.test(action)) return 'thinking';
  return 'working';
}

export const activities = {
  reading: ['Reading files', '▤'],
  coding: ['Writing code', '</>'],
  searching: ['Searching', '⌕'],
  testing: ['Running tests', '✓'],
  running: ['Running a command', '>_'],
  thinking: ['Thinking / planning', '✦'],
  working: ['Working · action unspecified', '↗'],
  waiting: ['Waiting for input', 'Ⅱ'],
  completed: ['Work completed', '✓'],
  idle: ['Ready for work', '◷'],
  stale: ['Report is stale', '◷'],
  failed: ['Session failed', '!'],
  disconnected: ['Connection lost', '⊘'],
};
