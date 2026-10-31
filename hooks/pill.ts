import type { Bar } from '../types'
import { STALL_MS } from './bar'

/** One run of text with one style. */
export type Piece = { text: string; color?: string; bg?: string; bold?: boolean; dim?: boolean }

/** The colors of one state: the fill, the text on it, and the sparkles on the empty track. */
type Palette = { fill: string; ink: string; spark: string[] }

const TRACK_BG = '#24222e'
const MUTED = '#8a8799'
const PALETTES: Record<'run' | 'stall' | 'complete' | 'fail', Palette> = {
  run: { fill: '#9b7bf2', ink: '#ffffff', spark: ['#4b3f78', '#6a58b0', '#8d78e6', '#3a3358'] },
  stall: { fill: '#e0a43a', ink: '#1d1608', spark: ['#5a4520', '#86652a', '#3d321c'] },
  complete: { fill: '#34b98a', ink: '#06231a', spark: ['#1f5a45', '#2b7d60'] },
  fail: { fill: '#e5534b', ink: '#ffffff', spark: ['#5c2523', '#7a302d'] },
}
const SPARKS = ['·', '∙', '⋅', '˙', '·', '✦']
const SWEEP_MS = 120
const SPARK_MS = 250
// A pixel critter that hops: two cells, two frames.
const MASCOT = ['▟▙', '▜▛']
const MASCOT_COLOR = '#e8794a'

const NAME_MAX = 14
const PILL_MIN = 14
const PILL_MAX = 46
const STATUS_ROOM = 22 // "0:09 · ~0:21 left" and a little more

function paletteOf(bar: Bar, now: number): Palette {
  if (bar.state === 'fail' || bar.state === 'stopped') return PALETTES.fail
  if (bar.state === 'complete') return PALETTES.complete
  return now - bar.updatedAt > STALL_MS ? PALETTES.stall : PALETTES.run
}

/** Formats ms as m:ss, or h:mm:ss from one hour. */
function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function bytes(n: number): string {
  const units = ['B', 'K', 'M', 'G', 'T', 'P']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return i === 0 ? `${Math.round(n)}B` : `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[i]}`
}

const amount = (bar: Bar, n: number) => (bar.unit === 'B' ? bytes(n) : Number.isInteger(n) ? String(n) : n.toFixed(1))

function cut(text: string, max: number): string {
  const chars = [...text]
  if (chars.length <= max) return text
  return max <= 1 ? '' : `${chars.slice(0, max - 1).join('')}…`
}

/** The text inside the pill: the detail and the count, as "Review 3/4". */
function labelOf(bar: Bar): string {
  const count = bar.unit === '%' || bar.total === null ? '' : `${amount(bar, bar.done)}/${amount(bar, bar.total)}`
  const detail = bar.state === 'complete' && !bar.label ? 'Done' : bar.label
  return [detail, count].filter(Boolean).join(' ')
}

function statusOf(bar: Bar, now: number): string {
  switch (bar.state) {
    case 'fail':
      return 'failed'
    case 'stopped':
      return 'stopped'
    case 'complete':
      return `done in ${duration((bar.endedAt ?? now) - bar.startedAt)}`
    case 'run': {
      const elapsed = duration(now - bar.startedAt)
      if (now - bar.updatedAt > STALL_MS) return `${elapsed} · quiet ${duration(now - bar.updatedAt)}`
      if (bar.total === null || bar.done >= bar.total) return elapsed
      if (bar.eta === null || bar.samples < 3 || now - bar.startedAt < 2000) return `${elapsed} · estimating`
      return `${elapsed} · ~${duration(bar.eta - (now - bar.progressAt))} left`
    }
  }
}

/** A stable pseudo-random number per cell and moment, so sparkles twinkle without state. */
function hash(a: number, b: number): number {
  let x = (a * 374761393 + b * 668265263) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** The cells of the pill: a filled part with the label inked on it, and a sparkly empty part. */
function pill(bar: Bar, w: number, now: number, p: Palette): Piece[] {
  const label = cut(labelOf(bar), w - 2)
  const start = Math.max(0, Math.floor((w - [...label].length) / 2))
  const labelChars = [...label]

  // The filled cells: a fraction of the width, or a moving segment with no total.
  let from = 0
  let to = w
  if (bar.total === null && bar.state === 'run') {
    const seg = Math.max(4, Math.floor(w / 3))
    const span = Math.max(1, w - seg)
    const step = Math.floor(now / SWEEP_MS) % (2 * span)
    from = step < span ? step : 2 * span - step
    to = from + seg
  } else if (bar.total !== null) {
    to = Math.round(Math.min(1, bar.done / bar.total) * w)
  }

  const tick = Math.floor(now / SPARK_MS)
  const cells: Piece[] = []
  for (let i = 0; i < w; i++) {
    const isFilled = i >= from && i < to
    const ch = labelChars[i - start]
    if (ch !== undefined) {
      cells.push(isFilled ? { text: ch, color: p.ink, bg: p.fill, bold: true } : { text: ch, color: '#d9d6e6', bg: TRACK_BG, bold: true })
    } else if (isFilled) {
      cells.push({ text: ' ', bg: p.fill })
    } else {
      const r = hash(i, tick)
      const isLit = r < 0.55
      const spark = SPARKS[Math.floor(hash(i, tick + 7) * SPARKS.length)] ?? '·'
      const color = p.spark[Math.floor(r * 97) % p.spark.length]
      cells.push({ text: isLit ? spark : ' ', color, bg: TRACK_BG })
    }
  }
  // Join neighbours of one style, so a row is a few runs rather than one per cell.
  const runs: Piece[] = []
  for (const c of cells) {
    const last = runs[runs.length - 1]
    if (last && last.color === c.color && last.bg === c.bg && last.bold === c.bold) last.text += c.text
    else runs.push({ ...c })
  }
  return runs
}

/** Lays one bar out as one row in `w` cells: ● name  ▐ pill ▌  42%  critter  0:12 · ~0:20 left */
export function row(bar: Bar, w: number, now: number): Piece[] {
  const p = paletteOf(bar, now)
  const pct = bar.total === null ? '' : `${Math.floor(Math.min(1, bar.done / bar.total) * 100 + 1e-9)}%`
  const status = statusOf(bar, now)
  const mascot = bar.state === 'run' ? (MASCOT[Math.floor(now / 400) % 2] ?? '') : bar.state === 'complete' ? '✓' : '✕'
  // A fixed name column and pill width, so the pills of several rows line up.
  const name = cut(bar.name, NAME_MAX).padEnd(NAME_MAX)

  // ● + space + name + 2 + caps(2) + 2 + pct(4) + 2 + mascot(2) + 2 + status
  const fixed = 2 + NAME_MAX + 2 + 2 + 2 + 4 + 2 + 2 + 2
  const room = w - fixed - STATUS_ROOM
  const showStatus = room >= PILL_MIN
  const pw = Math.max(PILL_MIN, Math.min(PILL_MAX, showStatus ? room : w - fixed))

  return [
    { text: '● ', color: p.fill },
    { text: name, bold: true },
    { text: '  ' },
    { text: '▐', color: TRACK_BG },
    ...pill(bar, pw, now, p),
    { text: '▌', color: TRACK_BG },
    { text: `  ${pct.padStart(4)}  `, color: MUTED },
    { text: mascot, color: bar.state === 'run' ? MASCOT_COLOR : p.fill, bold: true },
    { text: showStatus ? `  ${status}` : '', color: MUTED },
  ].filter(piece => piece.text !== '')
}
