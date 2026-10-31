import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Agents, Bar, Board } from '../types'
import { bar, cut, duration, mascot, modelName, tokens, typeColor } from './agents'
import { characterOf } from './anime'
import { row } from './pill'
import type { Piece } from './pill'
import { ingest, isTaskName, needsRead, settle } from './watch'
import type { Call, TaskFile } from './watch'
import { parse } from './parse'

// Reads the same task files that Simple Progress Bars' `claude-progress` writes,
// with that plugin's own tracking (bar.ts, parse.ts, watch.ts, MIT), and draws them as pills.

const board = atom({ plugin: 'sparkle-progress', key: 'board' } as const, { bars: [], now: 0 } as Board)
const agents = atom({ plugin: 'sparkle-progress', key: 'agents' } as const, { rows: [], now: 0 } as Agents)

const PANE = 'sparkle-agents'
const PANE_TITLE = 'Agents'
// `/agents` ships with Claude Code, and $.command.register refuses a built-in's name.
const COMMAND = 'sparkle-agents'

const TICK_MS = 250 // also the sparkle frame rate
const ID_CHECK_TICKS = 4
const CALL_KEEP_MS = 60_000
const INDENT = 2
const MAX_ROWS = 3

type Watch = {
  base: string | null
  dirs: string[]
  calls: Call[]
  hidden: Map<string, number>
  isBusy: boolean
  ticks: number
}

/** Lists one session directory. Reads only the files that changed, and skips hidden ones. */
async function readDir($: EngineInterface, w: Watch, dir: string, byKey: ReadonlyMap<string, Bar>): Promise<TaskFile[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const tasks = entries.filter(e => e.kind === 'file' && isTaskName(e.name))
    .filter(e => w.hidden.get(`${dir}/${e.name}`) !== e.mtimeMs)
  return Promise.all(tasks.map(async (entry): Promise<TaskFile> => {
    const key = `${dir}/${entry.name}`
    w.hidden.delete(key)
    const changed = needsRead(byKey.get(key), entry.mtimeMs) ? parse(await $.fs.read(key).catch(() => '')) : null
    return { key, name: entry.name, mtimeMs: entry.mtimeMs, update: changed }
  }))
}

async function track<T>($: EngineInterface, w: Watch, isBackground: boolean | undefined, run: () => Promise<T>): Promise<T> {
  if (isBackground) return run()
  const call: Call = { start: await $.clock.now(), end: null }
  w.calls.push(call)
  try {
    return await run()
  } finally {
    call.end = await $.clock.now()
  }
}

export const register: Register = on => {
  const w: Watch = { base: null, dirs: [], calls: [], hidden: new Map(), isBusy: false, ticks: 0 }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const [configDir, home, profile, id] = await Promise.all([
      $.env.get('CLAUDE_CONFIG_DIR'), $.env.get('HOME'), $.env.get('USERPROFILE'), $.session.id(),
    ])
    const config = configDir || (home || profile ? `${home || profile}/.claude` : null)
    if (config !== null) {
      w.base = `${config}/progress`
      w.dirs = [`${w.base}/${id}`]
      const tick = async () => {
        if (w.base === null || w.isBusy) return
        w.isBusy = true
        try {
          w.ticks += 1
          if (w.ticks % ID_CHECK_TICKS === 0) {
            const dir = `${w.base}/${await $.session.id()}`
            if (!w.dirs.includes(dir)) w.dirs.push(dir)
          }
          const now = await $.clock.now()
          const prev = await read($, board)
          w.calls = w.calls.filter(c => c.end === null || now - c.end < CALL_KEEP_MS)
          const byKey = new Map(prev.bars.map(b => [b.key, b]))
          const files = (await Promise.all(w.dirs.map(d => readDir($, w, d, byKey)))).flat()
          const { bars, expired } = settle(ingest(byKey, files), w.calls, now)
          for (const b of expired) w.hidden.set(b.key, b.updatedAt)
          // Redraw every tick while a bar shows, so the sparkles and the critter move.
          if (bars.length > 0 || prev.bars.length > 0) await update($, board, () => ({ bars, now }))
          // The Agents pane's clock: its times, sweeps and critters move while an agent runs.
          const crew = await read($, agents)
          if (crew.rows.some(a => a.status === 'running')) await update($, agents, s => ({ ...s, now }))
        } finally {
          w.isBusy = false
        }
      }
      $.clock.every(TICK_MS, () => void tick())
    }
    $.ui.toast('✦ Sparkle progress bars are on')
    await $.command.register({ name: COMMAND, description: 'Show the Agents pane: each subagent with its progress, tokens and time' })
    return result
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: PANE_TITLE })
    return { text: 'Agents pane opened.' }
  })

  // A subagent starts: it gets a card, and the pane opens.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const id = started.agentId
    if (id !== undefined) {
      const now = await $.clock.now()
      const fresh: AgentRow = {
        id, title: e.description || e.subagentType, type: e.subagentType, model: started.model ?? '',
        status: 'running', startedAt: now, endedAt: null, tools: 0, lastTool: '', tokens: 0,
      }
      // A new batch, after every earlier agent finished, starts a clean pane.
      await update($, agents, s => {
        const isNewBatch = s.rows.every(a => a.status !== 'running')
        return { rows: [...(isNewBatch ? [] : s.rows.filter(a => a.id !== id)), fresh], now }
      })
      void $.ui.open({ id: PANE, title: PANE_TITLE })
    }
    return started
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      await update($, agents, s => ({
        ...s, rows: s.rows.map(a => (a.id === id ? { ...a, tools: a.tools + 1, lastTool: e.tool } : a)),
      }))
    }
    return next(e)
  })

  // A subagent's run ends: its card turns done (or failed) and counts the run's tokens.
  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      const now = await $.clock.now()
      const u = e.usage
      const used = u ? u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0
      const status: AgentRow['status'] = e.reason === 'answer' ? 'done' : 'failed'
      await update($, agents, s => ({
        now,
        rows: s.rows.map(a => (a.id === id
          ? { ...a, status, endedAt: now, tokens: a.tokens + used, model: u?.model ?? a.model }
          : a)),
      }))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { rows, now } = await read($, agents)
    const usage = await $.session.usage().catch(() => null)
    const w = Math.max(28, (e.viewport?.columns ?? 48) - 2)

    if (rows.length === 0) {
      return (
        <Box flexDirection="column" paddingTop={1}>
          <Text dimColor>No agents yet. Cards appear here while subagents run.</Text>
        </Box>
      )
    }

    const first = Math.min(...rows.map(a => a.startedAt))
    const isRunning = rows.some(a => a.status === 'running')
    const last = isRunning ? now : Math.max(...rows.map(a => a.endedAt ?? now))
    const total = rows.reduce((n, a) => n + a.tokens, 0)
    const cost = usage?.cost ? `≈$${usage.cost.usd.toFixed(2)}` : '—'
    const running = rows.filter(a => a.status === 'running')
    const finished = rows.filter(a => a.status !== 'running').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))

    const metric = (label: string, value: string) => (
      <Box key={label} flexDirection="column" borderStyle="round" borderColor="#3a3848" paddingX={1} flexGrow={1}>
        <Text dimColor>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

    const card = (a: AgentRow) => {
      const color = typeColor(a.type)
      const critter = mascot(a, now)
      const who = characterOf(a)
      const mark = a.status === 'running'
        ? { text: '●', color: Math.floor(now / 500) % 2 === 0 ? '#e8794a' : '#7a3f26' }
        : a.status === 'done' ? { text: '✓', color: '#34b98a' } : { text: '✕', color: '#e5534b' }
      const info = w - 6
      const right = `${tokens(a.tokens)} · ${duration((a.endedAt ?? now) - a.startedAt)}`
      const steps = a.tools === 0 ? 'starting' : `${a.tools} tool${a.tools === 1 ? '' : 's'}${a.lastTool ? ` · ${a.lastTool}` : ''}`
      const lines: { text: string; color?: string; bold?: boolean; dim?: boolean }[][] = [
        [{ text: cut(a.title, info - 3).padEnd(info - 2), bold: true }, { text: ` ${mark.text}`, color: mark.color }],
        [
          ...(who ? [{ text: `${who.name} `, color: who.color, bold: true }] : []),
          { text: cut(a.type, 20), color }, { text: ` ${modelName(a.model)}`, dim: true },
        ],
        [{ text: cut(steps, info - right.length - 1).padEnd(info - right.length), dim: true }, { text: right, dim: true }],
      ]
      return (
        <Box key={a.id} flexDirection="column" paddingTop={1}>
          {lines.map((line, r) => (
            <Box key={`r${r}`} flexDirection="row">
              {(critter[r] ?? []).map((p, i) => (
                <Text key={`m${i}`} color={p.color} backgroundColor={p.bg} bold={p.bold}>{p.text}</Text>
              ))}
              <Text>  </Text>
              {line.map((p, i) => (
                <Text key={`t${i}`} color={p.color} bold={p.bold} dimColor={p.dim} wrap="truncate">{p.text}</Text>
              ))}
            </Box>
          ))}
          <Box key="bar" flexDirection="row">
            {bar(a, w, now).map((p, i) => (
              <Text key={`b${i}`} color={p.color} backgroundColor={p.bg}>{p.text}</Text>
            ))}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {metric('Session cost', cost)}
          {metric('Agent tokens', tokens(total))}
          {metric('Time', duration(last - first))}
        </Box>
        {running.length > 0 && <Box paddingTop={1}><Text dimColor>Running · {running.length}</Text></Box>}
        {running.map(card)}
        {finished.length > 0 && <Box paddingTop={1}><Text dimColor>Finished · {finished.length}</Text></Box>}
        {finished.map(card)}
      </Box>
    )
  })

  // Both plugins sit in the user tier, and Simple Progress Bars may run first and draw the band
  // without passing it on. Its board is emptied as it is written, so it always passes the band to us.
  on('state.set', { plugin: 'simple-progress-bars', key: 'board' }, ($, e, next) => next({ ...e, value: { bars: [], now: 0 } }))

  on('tool.call', { tool: 'Bash' },($, e, next) => track($, w, e.run_in_background, () => next(e)))
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => track($, w, e.run_in_background, () => next(e)))

  // Answers the band itself, without `next`: the plain bars beneath are replaced, not doubled.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { bars, now } = await read($, board)
    if (bars.length === 0 || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const width = e.props.bodyColumns - INDENT - 1
    const shown = bars.slice(0, Math.min(MAX_ROWS, e.props.maxRows))
    const more = bars.length - shown.length
    return (
      <Box flexDirection="column">
        {shown.map(bar => (
          <Box key={bar.key} flexDirection="row" paddingLeft={INDENT}>
            {row(bar, width, now).map((p: Piece, i) => (
              <Text key={String(i)} color={p.color} backgroundColor={p.bg} bold={p.bold} dimColor={p.dim} wrap="truncate">{p.text}</Text>
            ))}
          </Box>
        ))}
        {more > 0 ? <Box key="more" paddingLeft={INDENT}><Text dimColor>+{more} more</Text></Box> : null}
      </Box>
    )
  })
}
