#!/usr/bin/env node
/**
 * Behavioural verification for the qa preset, read from a real Session log.
 *
 * `validate.mjs` proves the declaration is well-formed. It cannot prove the
 * declaration actually produced the composition it promises — a preset mounts
 * and then behaves as whatever rows survived, so a wrong row set only shows up
 * in a request. This script reads the request header and system prompt the Host
 * actually sent, and checks them against the promises this bundle makes:
 *
 *   - the session ran the `qa` preset;
 *   - the read-only tools are present and every mutating/delegating tool is
 *     absent;
 *   - the persona rules reached the model;
 *   - the request stayed inside the token budget the preset is tuned for.
 *
 * Usage:
 *   node scripts/verify-session.mjs              # newest completed qa session
 *   node scripts/verify-session.mjs --all        # every qa session
 *   node scripts/verify-session.mjs --self-test  # prove the checks reject bad input
 *
 * Exit codes: 0 every check passed; 1 a check failed; 2 nothing to measure
 * (no qa session, or none created after the patch last changed).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const patchPath = join(root, 'cordis.patch.yml')

/** Tools this preset must expose: its own four, plus whatever host registers. */
const REQUIRED_TOOLS = ['read', 'read_image', 'web_search', 'web_fetch']

/**
 * Tools that must never appear. Each one either mutates state or delegates to
 * another agent — exactly what "asks a question, gets an answer, touches
 * nothing" rules out.
 *
 * `create_worktree`, `load_workspace_dependencies` and `sidebar_open` are
 * deliberately NOT here: the host register them globally and a preset cannot
 * exclude them without runtime code, so asserting their absence would fail
 * every honest install. They cost schema bytes; they cannot do the damage this
 * list guards against, because each needs a follow-up tool this preset lacks.
 */
const FORBIDDEN_TOOLS = [
  'bash', 'pwsh', 'write', 'edit', 'apply_patch', 'glob', 'grep',
  'job_list', 'job_output', 'job_kill',
  'subagent', 'subagent_fork', 'workflow', 'skill', 'list_agents', 'send_message',
  'todo_write', 'create_goal', 'get_goal', 'update_goal',
  'schedule_create', 'schedule_edit', 'schedule_list', 'schedule_view',
  'present', 'plugin_manager', 'ask_user_question',
]

/**
 * Tools the preset cannot exclude but that still raise the schema cost, and
 * whose presence is therefore reported without failing the run.
 */
const HOST_LEAKED_TOOLS = ['create_worktree', 'load_workspace_dependencies', 'sidebar_open', 'working_directory']

/** Phrases every assembly of the shipped persona must contain. */
const REQUIRED_PROMPT_PHRASES = ['结论先行', '不可信外部数据', '不写代码']

/**
 * Request budgets. These are regression guards, not targets: the measured
 * composition is ~1.2 K characters of prompt and ~11.7 KB of tool schemas with
 * dsh-free-search mounted, so the ceilings leave room for host variation while
 * still catching the failure this preset exists to prevent — a request that
 * grew back to coding-agent size.
 */
const BUDGETS = {
  systemPromptChars: 3000,
  toolSchemaBytes: 14000,
  toolCount: 20,
}

/**
 * Audit one already-parsed session: its header, request header, and system prompt.
 * @param entry - `{ agentPreset, createdAt, tools, systemPrompt }`; any field may be absent.
 * @param options - `{ patchedAt }`: patch mtime, so a pre-change session skips budgets.
 * @returns failures and the measurements, so a pass still prints what it saw.
 */
export function audit(entry, { patchedAt } = {}) {
  const failures = []
  const notes = []

  if (entry.agentPreset !== 'qa') {
    failures.push(`session runs preset ${JSON.stringify(entry.agentPreset)}, expected "qa"`)
  }

  const names = Array.isArray(entry.tools) ? entry.tools.map(tool => tool?.name) : undefined
  if (names === undefined) {
    failures.push('no request header: the session never sent a model request')
  } else {
    for (const required of REQUIRED_TOOLS) {
      if (!names.includes(required)) failures.push(`required tool "${required}" is missing`)
    }
    const forbidden = FORBIDDEN_TOOLS.filter(name => names.includes(name))
    if (forbidden.length > 0) failures.push(`forbidden tool(s) present: ${forbidden.join(', ')}`)
    const bytes = entry.tools.reduce((total, tool) => total + Buffer.byteLength(JSON.stringify(tool)), 0)
    notes.push(`${names.length} tools, ${bytes} schema bytes`)
    const leaked = HOST_LEAKED_TOOLS.filter(name => names.includes(name))
    if (leaked.length > 0) notes.push(`host-registered, not excludable here: ${leaked.join(', ')}`)
  }

  if (typeof entry.systemPrompt !== 'string') {
    failures.push('no system prompt recorded: the persona cannot be checked')
  } else {
    for (const phrase of REQUIRED_PROMPT_PHRASES) {
      if (!entry.systemPrompt.includes(phrase)) failures.push(`system prompt lost the rule containing ${JSON.stringify(phrase)}`)
    }
    notes.push(`${entry.systemPrompt.length} system-prompt characters`)
  }

  // A session whose composition predates the current patch cannot measure it:
  // its log is a faithful record of the old rows. Reporting a budget failure
  // from it would blame the wrong revision, so say so instead.
  const stale = typeof patchedAt === 'number' && typeof entry.createdAt === 'number' && entry.createdAt < patchedAt
  if (stale) {
    notes.push('created before the current patch: budget checks not applicable')
  } else if (names !== undefined && typeof entry.systemPrompt === 'string') {
    const bytes = entry.tools.reduce((total, tool) => total + Buffer.byteLength(JSON.stringify(tool)), 0)
    if (entry.systemPrompt.length > BUDGETS.systemPromptChars) {
      failures.push(`system prompt is ${entry.systemPrompt.length} chars, budget ${BUDGETS.systemPromptChars}`)
    }
    if (bytes > BUDGETS.toolSchemaBytes) {
      failures.push(`tool schemas are ${bytes} bytes, budget ${BUDGETS.toolSchemaBytes}`)
    }
    if (names.length > BUDGETS.toolCount) {
      failures.push(`${names.length} tools, budget ${BUDGETS.toolCount}`)
    }
  }

  return { failures, notes }
}

/** Locate every session log under the DSH home, newest first. */
function sessionLogs() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const sessions = join(home, 'sessions')
  let workspaces = []
  try {
    workspaces = readdirSync(sessions)
  } catch {
    return []
  }
  const logs = []
  for (const workspace of workspaces) {
    let dirs = []
    try {
      dirs = readdirSync(join(sessions, workspace))
    } catch {
      continue
    }
    for (const dir of dirs) {
      const file = join(sessions, workspace, dir, 'session.v4.jsonl.zstd')
      try {
        logs.push({ file, mtime: statSync(file).mtimeMs })
      } catch {
        // A session still being written, or one from another DSH version.
      }
    }
  }
  return logs.sort((left, right) => right.mtime - left.mtime)
}

/**
 * Decompress a session log.
 *
 * DSH appends JSONL and compresses each append as its own Zstandard frame, so a
 * log is a concatenation of dozens of frames. Node's `zstdDecompressSync` stops
 * after the first one, which would silently reduce a 50-line session to its
 * header line and make every check pass on no data. Split on the frame magic and
 * decode each frame instead.
 * @param raw - the complete `.jsonl.zstd` file bytes.
 * @returns the decoded UTF-8 text of every frame, concatenated.
 */
function decompressLog(raw) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const offsets = []
  for (let index = 0; index <= raw.length - MAGIC.length; index += 1) {
    if (raw[index] === MAGIC[0] && raw[index + 1] === MAGIC[1] && raw[index + 2] === MAGIC[2] && raw[index + 3] === MAGIC[3]) {
      offsets.push(index)
    }
  }
  if (offsets.length === 0) throw new Error('not a Zstandard stream')
  const parts = offsets.map((start, index) =>
    zstdDecompressSync(raw.subarray(start, index + 1 < offsets.length ? offsets[index + 1] : raw.length)))
  return Buffer.concat(parts).toString('utf8')
}

/** Parse one session log into the fields {@link audit} reads. */
function readSession(file) {
  const rows = decompressLog(readFileSync(file))
    .split('\n')
    .filter(line => line.trim() !== '')
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })

  const header = rows.find(row => row.type === 'session')
  const request = rows.find(row => row.type === 'request/header')
  const system = rows.find(row => row.type === 'system/message')
  return {
    agentPreset: header?.agentPreset,
    createdAt: header?.createdAt,
    tools: request?.data?.header?.tools,
    systemPrompt: system?.data?.message?.content?.[0]?.text,
  }
}

/**
 * Fixtures that must be rejected, and one that must pass. Injected failures are
 * the only way to know the assertions above actually bite: a check that never
 * fails looks identical to a check that always passes.
 */
function selfTest() {
  const good = {
    agentPreset: 'qa',
    createdAt: 2,
    tools: REQUIRED_TOOLS.map(name => ({ name })),
    systemPrompt: REQUIRED_PROMPT_PHRASES.join(' / '),
  }
  const cases = [
    { name: 'a valid session', entry: good, expect: 0 },
    { name: 'the wrong preset', entry: { ...good, agentPreset: 'standard' }, expect: 1 },
    { name: 'a mutating tool', entry: { ...good, tools: [...good.tools, { name: 'bash' }] }, expect: 1 },
    { name: 'a missing read tool', entry: { ...good, tools: [{ name: 'web_search' }] }, expect: 1 },
    { name: 'a lost persona rule', entry: { ...good, systemPrompt: '结论先行' }, expect: 1 },
    { name: 'no request at all', entry: { ...good, tools: undefined }, expect: 1 },
    {
      name: 'a bloated prompt',
      entry: { ...good, systemPrompt: `${REQUIRED_PROMPT_PHRASES.join(' ')}${'x'.repeat(BUDGETS.systemPromptChars)}` },
      expect: 1,
    },
    {
      name: 'a bloated tool catalog',
      entry: {
        ...good,
        tools: [
          ...REQUIRED_TOOLS.map(name => ({ name })),
          ...Array.from({ length: 16 }, (_, index) => ({ name: `extra_${index}`, description: 'x'.repeat(1000) })),
        ],
      },
      expect: 1,
    },
    {
      name: 'too many tools',
      entry: {
        ...good,
        tools: [
          ...REQUIRED_TOOLS.map(name => ({ name })),
          ...Array.from({ length: BUDGETS.toolCount }, (_, index) => ({ name: `extra_${index}` })),
        ],
      },
      expect: 1,
    },
  ]

  let failed = 0
  for (const testCase of cases) {
    const { failures } = audit(testCase.entry, { patchedAt: 1 })
    const observed = failures.length === 0 ? 0 : 1
    if (observed !== testCase.expect) {
      console.error(`  FAIL  ${testCase.name}: expected ${testCase.expect === 0 ? 'pass' : 'a failure'}, got ${failures.length === 0 ? 'pass' : failures.join('; ')}`)
      failed += 1
    } else {
      console.log(`  ok    ${testCase.name}${testCase.expect === 1 ? ` (${failures[0]})` : ''}`)
    }
  }
  if (failed > 0) {
    console.error(`verify-session: ${failed} self-test case(s) did not behave as documented`)
    process.exit(1)
  }
  console.log(`verify-session: ${cases.length} self-test cases behaved as documented`)
}

function main(argv) {
  if (argv.includes('--self-test')) {
    selfTest()
    return
  }

  const patchedAt = statSync(patchPath, { throwIfNoEntry: false })?.mtimeMs
  const all = argv.includes('--all')
  // A qa session with no request proves nothing about the composition: it may
  // be one the user opened and closed, or one still composing. Only sessions
  // that actually sent a model request can be audited, so pick from those and
  // report the skipped ones rather than failing on them.
  const qaSessions = []
  const skippedNoRequest = []
  for (const log of sessionLogs()) {
    let entry
    try {
      entry = readSession(log.file)
    } catch {
      continue
    }
    if (entry.agentPreset !== 'qa') continue
    if (Array.isArray(entry.tools) && entry.tools.length > 0 && typeof entry.systemPrompt === 'string') {
      qaSessions.push({ log, entry })
    } else {
      skippedNoRequest.push(log.file.split('/').slice(-2, -1)[0])
    }
  }
  for (const skipped of skippedNoRequest) {
    console.log(`  skip  ${skipped} — no model request yet`)
  }
  if (qaSessions.length === 0) {
    console.error('verify-session: no qa session has sent a model request yet; open one in the app, ask a question, then rerun')
    process.exit(2)
  }

  const selected = all ? qaSessions : qaSessions.slice(0, 1)
  let failed = 0
  for (const { log, entry } of selected) {
    const { failures, notes } = audit(entry, { patchedAt })
    const label = `${log.file.split('/').slice(-2, -1)[0]}`
    if (failures.length === 0) {
      console.log(`  ok    ${label} — ${notes.join(', ')}`)
    } else {
      failed += 1
      console.error(`  FAIL  ${label}`)
      for (const failure of failures) console.error(`          ${failure}`)
    }
  }
  if (failed > 0) {
    console.error(`verify-session: ${failed} session(s) failed`)
    process.exit(1)
  }
  const anyMeasured = selected.some(({ entry }) =>
    !(typeof patchedAt === 'number' && typeof entry.createdAt === 'number' && entry.createdAt < patchedAt))
  if (!anyMeasured) {
    console.error('verify-session: every qa session predates the current patch, so no budget was measured; start a new qa session and rerun')
    process.exit(2)
  }
  console.log(`verify-session: ${selected.length} session(s) match the shipped preset`)
}


// Run only as a program, so the exported audit can be reused by a test harness
// without decompressing this machine's sessions.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
