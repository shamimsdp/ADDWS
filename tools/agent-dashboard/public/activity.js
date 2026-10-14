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

// Playful stand-ins for "working, action unspecified". Stable for a while per agent, then it rotates.
const FUNNY = [
  'Untangling code…',
  'Asking the duck…',
  'Bribing linters…',
  'Herding commas…',
  'Feeding hamsters…',
  'Teaching bytes…',
  'Blaming the cache…',
  'Counting to NaN…',
  'Tea-leaf reading…',
  'Polishing pixels…',
  'Charming the bugs…',
  'Caffeinating…',
];
export function funnyWorking(seed = '', now = Date.now()) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FUNNY[(hash + Math.floor(now / 45000)) % FUNNY.length];
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
