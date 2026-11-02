/**
 * run: in progress. complete: done. fail: the script reported a failure.
 * stopped: the Bash call that ran it ended before the task was done.
 */
export type BarState = 'run' | 'complete' | 'fail' | 'stopped'

/** '' for a count, 'B' for bytes, '%' for percent. */
export type BarUnit = '' | 'B' | '%'

/** One task as the plugin shows it. All times are ms since the epoch. */
export type Bar = {
  /** The path of the task file: unique across the watched session directories. */
  key: string
  /** The task name: the file name. */
  name: string
  /** Detail text, or the failure message. */
  label: string
  done: number
  /** null when the script gave no total (an indeterminate bar). */
  total: number | null
  unit: BarUnit
  state: BarState
  /** The first update of this run. */
  startedAt: number
  /** The file's modification time at the last update. */
  updatedAt: number
  /** The last update that changed the count. The rate and the estimate count from it. */
  progressAt: number
  /** When the bar left the run state, or null while it runs. */
  endedAt: number | null
  /** The number of updates that changed the count in this run. */
  samples: number
  /** The smoothed rate in units per ms, or null before two counted updates. */
  rate: number | null
  /** The shown time left at progressAt, in ms, or null while estimating. */
  eta: number | null
}

export type Board = { bars: Bar[]; now: number }

/** One subagent as the Agents pane shows it. Times are ms since the epoch. */
export type AgentRow = {
  id: string
  /** The Agent call's short description. */
  title: string
  /** The agent type: general-purpose, Explore, a plugin's agent, fork. */
  type: string
  model: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  /** Its latest sign of life: its start or its last tool call. */
  activeAt?: number
  endedAt: number | null
  /** Tool calls its loop made, and the last tool's name. */
  tools: number
  lastTool: string
  /** Input, output and cache tokens of its finished turns. */
  tokens: number
}

export type Agents = { rows: AgentRow[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'sparkle-progress': { board: Board; agents: Agents }
    /** Simple Progress Bars' own board, emptied on write by the state.set hook. */
    'simple-progress-bars': { board: Board }
  }
}
