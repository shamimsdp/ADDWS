import { execFileSync } from 'node:child_process';
import { open, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { report } from './store.mjs';

const WINDOW = 2 * 1024 * 1024;
const MAX_LINE = 512 * 1024;
const MAX_FILES = 20_000;

function normalized(value) {
  if (typeof value !== 'string') return '';
  const resolved = path.resolve(value).replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function workspaces(root) {
  const result = new Set([normalized(root)]);
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const line of output.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) result.add(normalized(line.slice(9)));
    }
  } catch {
    // A non-git workspace still has an exact root boundary.
  }
  return result;
}

function role(meta) {
  const child = meta.source?.subagent?.thread_spawn ?? meta.thread_source?.subagent?.thread_spawn;
  const agentPath = meta.agent_path ?? child?.agent_path;
  // The root session coordinates; it is tracked as the main session, never as Minhaj.
  if (typeof agentPath !== 'string')
    return child || (typeof meta.source === 'object' && meta.source?.subagent) ? null : 'main';
  if (agentPath === '/root') return 'main';
  const leaf = agentPath.split('/').at(-1);
  for (const name of ['minhaj', 'rabbi', 'shamim', 'tanvir', 'nadia']) {
    if (new RegExp(`^${name}(?:[_-]|$)`).test(leaf)) return name;
  }
  if (/^dashboard[_-]qa(?:[_-]|$)/.test(leaf)) return 'tanvir';
  if (/^dashboard[_-]ui(?:[_-]|$)/.test(leaf)) return 'shamim';
  return null;
}

function category(name) {
  if (typeof name !== 'string') return 'Working';
  if (/apply_patch|write_file|edit_file/.test(name)) return 'Writing code';
  if (/get_code_snippet|read_file|read_mcp_resource|Get-Content/.test(name)) return 'Reading files';
  if (/search|query_graph|trace_path|get_architecture|index_repository/.test(name))
    return 'Searching';
  if (/exec_command|write_stdin|shell|terminal/.test(name)) return 'Running commands';
  if (/request_user_input/.test(name)) return 'Waiting for input';
  return 'Working';
}

function commandAction(command) {
  if (typeof command !== 'string') return 'Running commands';
  const prefix = command.trim().slice(0, 200);
  if (/^(Get-Content|cat|head|tail)\b/i.test(prefix)) return 'Reading files';
  if (/^rg\b/i.test(prefix)) return 'Searching';
  if (
    /^(pnpm|npm|npx|node)\b[^;|&\r\n]*\b(vitest|playwright|test(?:[:_-][a-z_-]+)?)\b/i.test(prefix)
  )
    return 'Running tests';
  return 'Running commands';
}

function invocationAction(payload) {
  const direct = category(payload.name ?? payload.invocation?.tool);
  if (payload.name === 'exec_command') {
    try {
      return commandAction(JSON.parse(payload.arguments ?? '{}').cmd);
    } catch {
      return direct;
    }
  }
  if (payload.name !== 'exec') return direct;
  // Inspect invocation identifiers only. Never evaluate JavaScript or retain tool arguments.
  const code = typeof payload.input === 'string' ? payload.input.slice(0, MAX_LINE) : '';
  const identifiers = code
    .replace(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
      (value) => ' '.repeat(value.length),
    )
    .matchAll(/\btools\.[A-Za-z_][A-Za-z0-9_]*\s*\(/g);
  const categories = [...identifiers].map((identifier) => {
    const action = category(identifier[0]);
    if (!identifier[0].includes('exec_command')) return action;
    // Only inspect the command's leading verbs, never retain commands or filenames.
    const argumentPrefix = code.slice(
      identifier.index + identifier[0].length,
      identifier.index + identifier[0].length + 300,
    );
    const command = argumentPrefix.match(/^\s*\{\s*(?:cmd|"cmd"|'cmd')\s*:\s*["']([^"'\\]{0,200})/);
    return commandAction(command?.[1]);
  });
  return (
    ['Writing code', 'Reading files', 'Searching', 'Running tests', 'Running commands'].find(
      (action) => categories.includes(action),
    ) ?? 'Working'
  );
}

async function filesIn(folder, depth = 0, result = []) {
  if (depth > 4 || result.length >= MAX_FILES) return result;
  const entries = await readdir(folder, { withFileTypes: true });
  // Date directories sort newest first, but old reopened files remain discoverable.
  entries.sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of entries) {
    if (result.length >= MAX_FILES) break;
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) await filesIn(filename, depth + 1, result);
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) result.push(filename);
  }
  return result;
}

async function bytes(filename, offset, length) {
  const file = await open(filename, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

function parse(line) {
  if (!line || Buffer.byteLength(line) > MAX_LINE) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Observe local Codex lifecycle metadata; transcript contents never leave this process. */
export function startCodexCollector({
  root,
  directory,
  sessionsRoot = path.join(os.homedir(), '.codex', 'sessions'),
  intervalMs = 1000,
}) {
  const roots = workspaces(root);
  const tracked = new Map();
  const diagnostics = {
    available: false,
    sessions: 0,
    count: 0,
    lastEventAt: null,
    lastPollAt: null,
    errorGeneric: null,
  };
  let closed = false;
  let busy = null;

  async function emit(state, kind = 'activity') {
    if (!state.at || !state.status) return;
    await report(
      directory,
      {
        agent: state.agent,
        source: 'codex',
        sessionId: `runtime:${state.id}`,
        status: state.status,
        kind,
        action: state.action,
        task: 'Observed local Codex activity',
        cwd: state.cwd,
      },
      new Date(state.at),
    );
    diagnostics.count++;
    if (!diagnostics.lastEventAt || state.at > diagnostics.lastEventAt)
      diagnostics.lastEventAt = state.at;
  }

  function observe(state, entry) {
    if (!entry || !Number.isFinite(Date.parse(entry.timestamp))) return null;
    const payload = entry.payload ?? {};
    const type = payload.type;
    let status = state.status;
    let action = state.action;
    let kind = 'activity';
    if (entry.type === 'event_msg') {
      if (type === 'task_started') {
        state.calls.clear();
        status = 'active';
        action = 'Working';
      } else if (type === 'task_complete' || type === 'turn_aborted') {
        state.calls.clear();
        status = type === 'task_complete' ? 'completed' : 'idle';
        action = type === 'task_complete' ? 'Completed' : 'Stopped';
      } else if (type === 'token_count' && status === 'active') {
        kind = 'heartbeat';
      } else if (/^(patch_apply|exec_command|mcp_tool_call)_begin$/.test(type)) {
        action =
          type === 'patch_apply_begin'
            ? 'Writing code'
            : type === 'exec_command_begin'
              ? 'Running commands'
              : invocationAction(payload);
        status = 'active';
        state.calls.set(payload.call_id ?? type, action);
      } else if (/^(patch_apply|exec_command|mcp_tool_call)_end$/.test(type)) {
        state.calls.delete(payload.call_id ?? type.replace('_end', '_begin'));
        if (status !== 'active') return null;
        action = [...state.calls.values()].at(-1) ?? 'Working';
      } else return null;
    } else if (entry.type === 'response_item') {
      if (type === 'reasoning') {
        status = 'active';
        action = 'Thinking';
      } else if (type === 'function_call' || type === 'custom_tool_call') {
        action = invocationAction(payload);
        status = action === 'Waiting for input' ? 'waiting' : 'active';
        state.calls.set(payload.call_id ?? payload.id ?? type, action);
      } else if (type === 'function_call_output' || type === 'custom_tool_call_output') {
        state.calls.delete(payload.call_id ?? payload.id ?? type);
        if (!['active', 'waiting'].includes(status)) return null;
        status = 'active';
        action = [...state.calls.values()].at(-1) ?? 'Working';
      } else return null;
    } else return null;
    state.status = status;
    state.action = action;
    state.at = new Date(entry.timestamp).toISOString();
    return kind;
  }

  async function scan(filename) {
    const info = await stat(filename);
    let state = tracked.get(filename);
    if (state && info.size < state.offset) {
      tracked.delete(filename);
      state = null;
    }
    let initialize = false;
    if (!state) {
      const prefix = await bytes(filename, 0, Math.min(info.size, MAX_LINE));
      const newline = prefix.indexOf(10);
      if (newline < 0) return;
      const meta = parse(prefix.subarray(0, newline).toString('utf8'));
      const payload = meta?.type === 'session_meta' ? meta.payload : null;
      // Child rollouts retain the parent's session_id; id identifies the actual thread.
      const id = payload?.id ?? payload?.session_id;
      const agent = payload && role(payload);
      const accepted =
        payload &&
        roots.has(normalized(payload.cwd)) &&
        agent &&
        typeof id === 'string' &&
        /^[a-zA-Z0-9:_-]{1,80}$/.test(id);
      state = {
        accepted,
        offset: 0,
        pending: Buffer.alloc(0),
        calls: new Map(),
        id,
        agent,
        cwd: payload?.cwd,
      };
      tracked.set(filename, state);
      if (!accepted) return;
      initialize = true;
      state.offset = Math.max(0, info.size - WINDOW);
      state.skipLine = state.offset > 0;
    }
    if (!state.accepted || info.size === state.offset) return;
    const length = Math.min(WINDOW, info.size - state.offset);
    const chunk = await bytes(filename, state.offset, length);
    state.offset += chunk.length;
    const content = Buffer.concat([state.pending, chunk]);
    let start = 0;
    let newline;
    const observed = new Map();
    while ((newline = content.indexOf(10, start)) !== -1) {
      if (state.skipLine) state.skipLine = false;
      else {
        const kind = observe(state, parse(content.subarray(start, newline).toString('utf8')));
        if (kind && !initialize) observed.set(state.at, { state: { ...state }, kind });
      }
      start = newline + 1;
    }
    state.pending = content.subarray(start);
    if (state.pending.length > MAX_LINE) {
      state.pending = Buffer.alloc(0);
      state.skipLine = true;
    }
    if (initialize) await emit(state);
    else for (const event of observed.values()) await emit(event.state, event.kind);
  }

  async function collect() {
    diagnostics.lastPollAt = new Date().toISOString();
    try {
      const files = await filesIn(sessionsRoot);
      diagnostics.available = true;
      diagnostics.errorGeneric = null;
      for (const filename of files) {
        if (closed) break;
        try {
          await scan(filename);
        } catch {
          diagnostics.errorGeneric = 'Some local runtime metadata could not be read.';
        }
      }
      diagnostics.sessions = [...tracked.values()].filter((state) => state.accepted).length;
    } catch {
      diagnostics.available = false;
      diagnostics.errorGeneric = 'Local Codex runtime metadata is unavailable.';
    }
  }

  function poll() {
    if (closed) return Promise.resolve();
    if (busy) return busy;
    busy = collect().finally(() => {
      busy = null;
    });
    return busy;
  }
  const timer = setInterval(
    () => {
      void poll();
    },
    Math.max(100, intervalMs),
  );
  timer.unref();
  void poll();
  return {
    poll,
    status: () => ({ ...diagnostics }),
    close: () => {
      closed = true;
      clearInterval(timer);
    },
  };
}
