import type { AgentRow } from '../types'
import type { Piece } from './agents'

/** What an agent is doing. It picks the character within its model's anime. */
export type Role = 'lead' | 'scout' | 'plan' | 'guide' | 'review' | 'medic' | 'clone'

/** One character: a name for the card, and the cells of its three-row critter, four wide. */
export type Look = {
  name: string
  /** The name's color on the card. */
  color: string
  hair: Piece[]
  /** The cells either side of the eyes: cheeks, hair, a mask. */
  sides: [Piece, Piece]
  skin: string
  /** Two cells while it runs, and the color of each, or one color for both. */
  eyes: string
  ink: string | [string, string]
  /** The eyes once done: ^^ unless the character has its own. */
  happy?: string
  /** The whole face, for a character that is not two eyes between two sides. */
  face?: (mood: Mood) => Piece[]
  legs: (step: boolean) => Piece[]
  /** Drawn in place of the critter once done: the shadow clone's puff of smoke. */
  gone?: Piece[][]
}

type Mood = 'run' | 'done' | 'fail'

const SKIN = '#f3c9a0'
const DARK = '#2a1408'

const walk = (color: string) => (step: boolean): Piece[] => [{ text: step ? '▘▝▘▝' : '▝▘▝▘', color }]
// Two colors, left leg and right: a haori in two halves.
const halves = (left: string, right: string) => (step: boolean): Piece[] => [
  { text: step ? '▘▝' : '▝▘', color: left }, { text: step ? '▘▝' : '▝▘', color: right },
]
const skin = (text: string): Piece => ({ text, color: SKIN })
const hair = (color: string): [Piece, Piece] => [{ text: '▐', color }, { text: '▌', color }]
const ears: [Piece, Piece] = [skin('▐'), skin('▌')]

const NARUTO_LOOK: Look = {
  name: 'Naruto', color: '#f28c28',
  hair: [{ text: '▟▙▟▙', color: '#f5c518' }],
  sides: [{ text: '≡', color: '#9a6a40', bg: SKIN }, { text: '≡', color: '#9a6a40', bg: SKIN }],
  skin: SKIN, eyes: '••', ink: '#2d6fe0', legs: walk('#f28c28'),
}

const NARUTO: Record<Role, Look> = {
  lead: NARUTO_LOOK,
  clone: {
    ...NARUTO_LOOK, name: 'Shadow Clone', color: '#c98a4a',
    hair: [{ text: '▟▙▟▙', color: '#b8993e' }], legs: walk('#b0702e'),
    gone: [[{ text: '▗▄▄▖', color: '#8a8799' }], [{ text: '▐░▒▌', color: '#8a8799' }], [{ text: '▝▀▀▘', color: '#8a8799' }]],
  },
  plan: {
    name: 'Shikamaru', color: '#7f9c4a',
    hair: [{ text: ' ▟▙ ', color: '#5a5a6e' }],
    sides: ears, skin: SKIN, eyes: '--', ink: DARK, legs: walk('#6b8e3d'),
  },
  review: {
    name: 'Kakashi', color: '#a9b0c4',
    hair: [{ text: '▗▟██', color: '#c8ccd8' }],
    sides: hair('#34406a'), skin: SKIN, eyes: '▬•', ink: ['#8e97a8', DARK], happy: '▬^', legs: walk('#34406a'),
  },
  scout: {
    name: 'Neji', color: '#b9b0e0',
    hair: [{ text: '▄██▄', color: '#6e4b3a' }],
    sides: [{ text: '█', color: '#6e4b3a' }, { text: '█', color: '#6e4b3a' }],
    skin: SKIN, eyes: '◦◦', ink: '#8f84c4', legs: walk('#e2dccb'),
  },
  medic: {
    name: 'Sakura', color: '#f49ac2',
    hair: [{ text: '▄██▄', color: '#f49ac2' }],
    sides: hair('#f49ac2'), skin: SKIN, eyes: '••', ink: '#2f9e5e', legs: walk('#d8343a'),
  },
  guide: {
    name: 'Jiraiya', color: '#e8e8ee',
    hair: [{ text: '▟▙▟▙', color: '#e8e8ee' }],
    sides: hair('#e8e8ee'), skin: SKIN, eyes: '••', ink: DARK, legs: halves('#c0392b', '#3e7d4f'),
  },
}

const DEMON_SLAYER: Record<Role, Look> = {
  lead: {
    name: 'Tanjiro', color: '#2e9b5f',
    hair: [{ text: '▟▀▀▙', color: '#a2382b' }],
    sides: [{ text: '┊', color: '#e0412a', bg: SKIN }, { text: '┊', color: '#e0412a', bg: SKIN }],
    skin: SKIN, eyes: '••', ink: '#b0302a',
    // The checkered haori shimmers as he walks.
    legs: step => [{ text: step ? '▞▚▞▚' : '▚▞▚▞', color: '#2e9b5f', bg: '#1a1a1a' }],
  },
  clone: {
    name: 'Nezuko', color: '#f28ab2',
    hair: [{ text: '▄█', color: '#4a3a4e' }, { text: '█', color: '#e8833a' }, { text: '◆', color: '#f28ab2' }],
    sides: hair('#4a3a4e'), skin: SKIN, eyes: '••', ink: '#e86aa8',
    // The bamboo muzzle, between her feet.
    legs: step => [{ text: step ? '▘' : '▝', color: '#f4a6c1' }, { text: '▬▬', color: '#7fb069' }, { text: step ? '▝' : '▘', color: '#f4a6c1' }],
  },
  scout: {
    name: 'Inosuke', color: '#94a7bd',
    hair: [{ text: '▙▄▄▟', color: '#94a7bd' }],
    sides: hair('#94a7bd'), skin: '#94a7bd', eyes: '••', ink: '#f4f4f8', legs: walk('#7a5a3a'),
  },
  plan: {
    name: 'Tengen', color: '#d94f8f',
    hair: [{ text: '▄', color: '#e8e8ee' }, { text: '◆', color: '#e0453a' }, { text: '◆', color: '#3fbf6a' }, { text: '▄', color: '#e8e8ee' }],
    sides: ears, skin: SKIN, eyes: '••', ink: '#c0397a', legs: walk('#3c4363'),
  },
  guide: {
    name: 'Rengoku', color: '#f5b301',
    hair: [{ text: '▟', color: '#f5b301' }, { text: '▙', color: '#e0412a' }, { text: '▟', color: '#f5b301' }, { text: '▙', color: '#e0412a' }],
    sides: ears, skin: SKIN, eyes: '••', ink: '#e0412a', legs: halves('#f5b301', '#e0412a'),
  },
  review: {
    name: 'Giyu', color: '#3a6fd8',
    hair: [{ text: '▄▀▀▄', color: '#3d4a6e' }],
    sides: ears, skin: SKIN, eyes: '••', ink: '#3a6fd8', legs: halves('#8e2b2b', '#4f9a5a'),
  },
  medic: {
    name: 'Shinobu', color: '#b48ee6',
    hair: [{ text: '▄█▀', color: '#4a3a66' }, { text: '⋈', color: '#c78ce6' }],
    sides: hair('#4a3a66'), skin: SKIN, eyes: '••', ink: '#9b6fd6', legs: halves('#a6e3c4', '#f5c6e0'),
  },
}

const STRAW = '#e8c35a'
const FUR = '#a0603a'
const eye = (mood: Mood) => (mood === 'fail' ? '×' : mood === 'done' ? '^' : '•')

const ONE_PIECE: Record<Role, Look> = {
  lead: {
    name: 'Luffy', color: '#d63a2f',
    hair: [{ text: '▄', color: STRAW }, { text: '▀▀', color: STRAW, bg: '#d63a2f' }, { text: '▄', color: STRAW }],
    sides: ears, skin: SKIN, eyes: '••', ink: DARK, legs: walk('#d63a2f'),
  },
  clone: {
    name: 'Ace', color: '#e67e22',
    hair: [{ text: '▄', color: '#e67e22' }, { text: '▀▀', color: '#e67e22', bg: '#5a3a1a' }, { text: '▄', color: '#e67e22' }],
    sides: [{ text: '∵', color: '#a0603a', bg: SKIN }, { text: '∵', color: '#a0603a', bg: SKIN }],
    skin: SKIN, eyes: '••', ink: DARK, legs: walk('#6d5a48'),
  },
  scout: {
    name: 'Usopp', color: '#f1c40f',
    hair: [{ text: '▄', color: '#5e4632' }, { text: '◎◎', color: '#f1c40f' }, { text: '▄', color: '#5e4632' }],
    // The long nose sticks out past his face.
    sides: [skin('▐'), skin('▬')], skin: SKIN, eyes: '••', ink: DARK, legs: walk('#c9a26b'),
  },
  plan: {
    name: 'Nami', color: '#f07c2a',
    hair: [{ text: '▄██▄', color: '#f07c2a' }],
    sides: hair('#f07c2a'), skin: SKIN, eyes: '••', ink: '#7a4a2a', legs: walk('#4aa8e8'),
  },
  guide: {
    name: 'Robin', color: '#8e6bbf',
    hair: [{ text: '▄██▄', color: '#4b4b6b' }],
    sides: hair('#4b4b6b'), skin: SKIN, eyes: '••', ink: '#4a8ad8', happy: '✿✿', legs: walk('#8e6bbf'),
  },
  review: {
    name: 'Zoro', color: '#3aa655',
    hair: [{ text: '▄▄▄▄', color: '#3aa655' }],
    sides: [skin('▐'), { text: '⁝', color: '#f1c40f', bg: SKIN }],
    skin: SKIN, eyes: '-•', ink: DARK, happy: '-^', legs: walk('#3a7d44'),
  },
  medic: {
    name: 'Chopper', color: '#ef6ea0',
    hair: [{ text: '▗', color: '#ef6ea0' }, { text: '✕', color: '#ffffff', bg: '#ef6ea0' }, { text: ' ', bg: '#ef6ea0' }, { text: '▖', color: '#ef6ea0' }],
    sides: [{ text: '▐', color: FUR }, { text: '▌', color: FUR }], skin: FUR, eyes: '••', ink: DARK,
    // His blue nose sits between his eyes.
    face: mood => [
      { text: '▐', color: FUR }, { text: eye(mood), color: DARK, bg: FUR, bold: true },
      { text: '▾', color: '#3b7dd8', bg: FUR, bold: true }, { text: eye(mood), color: DARK, bg: FUR, bold: true },
    ],
    legs: walk(FUR),
  },
}

const ANIME: Record<string, Record<Role, Look>> = { opus: NARUTO, sonnet: DEMON_SLAYER, haiku: ONE_PIECE }

const BY_TYPE: Record<string, Role> = { Explore: 'scout', Plan: 'plan', 'claude-code-guide': 'guide', fork: 'clone' }
// For an agent of any other type, the first of these its title matches.
const BY_WORD: [Role, RegExp][] = [
  ['review', /\b(review|audit|critique|inspect|verify)/i],
  ['medic', /\b(debug|fix|bug|error|test|diagnos|repair)/i],
  ['plan', /\b(plan|design|architect|strateg)/i],
  ['scout', /\b(search|find|explore|locate|scan|inventor|survey|investigat)/i],
  ['guide', /\b(explain|docs?\b|document|guide|teach|tutorial|readme)/i],
]

/** The role an agent plays: by its type for the built-in ones, else by the words of its title. */
export function roleOf(a: AgentRow): Role {
  return BY_TYPE[a.type] ?? BY_WORD.find(([, words]) => words.test(a.title))?.[0] ?? 'lead'
}

/** The character an agent is drawn as, or null for a model with no anime. */
export function characterOf(a: AgentRow): Look | null {
  const family = /(opus|sonnet|haiku)/i.exec(a.model)?.[1]?.toLowerCase()
  const cast = family === undefined ? undefined : ANIME[family]
  return cast === undefined ? null : cast[roleOf(a)]
}

/** The three rows of a character: hair, a face by how its run went, and legs that step while it runs. */
export function drawCharacter(look: Look, status: AgentRow['status'], step: boolean): Piece[][] {
  const mood: Mood = status === 'failed' ? 'fail' : status === 'done' ? 'done' : 'run'
  if (mood === 'done' && look.gone) return look.gone
  const text = mood === 'fail' ? '××' : mood === 'done' ? (look.happy ?? '^^') : look.eyes
  const [left, right] = typeof look.ink === 'string' ? [look.ink, look.ink] : look.ink
  const face = look.face?.(mood) ?? [
    look.sides[0],
    { text: text.charAt(0), color: left, bg: look.skin, bold: true },
    { text: text.charAt(1), color: right, bg: look.skin, bold: true },
    look.sides[1],
  ]
  return [look.hair, face, look.legs(mood === 'run' && step)]
}
