import { expect, test } from 'claude-code/testing'

const NOW = 100_000

const agent = (over = {}) => ({
  id: 'a1', title: 'Build a maze', type: 'general-purpose', model: 'claude-opus-5-5', status: 'running',
  startedAt: NOW - 5000, activeAt: NOW - 1000, endedAt: null, tools: 2, lastTool: 'Bash', tokens: 1000, ...over,
})
const progress = {
  key: 'k', name: 'render', label: 'reel', done: 3, total: 10, unit: '', state: 'run',
  startedAt: NOW - 5000, updatedAt: NOW, progressAt: NOW, endedAt: null, samples: 2, rate: 0.1, eta: 1000,
}
const PANE = { id: 'sparkle-agents', title: 'Agents', isShown: true, isFocused: false, isPlaced: true }
const WAITING = { ...PANE, isShown: false, isPlaced: false }

const band = (surface: string, maxRows = 6) => ({
  plugin: 'sparkle-progress', component: 'AbovePrompt', requestId: 'band', surface,
  props: { hasSurvey: false, isWorking: true, maxRows, bodyColumns: 90, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
}) as any

/** Stands for the engine: the stored agents and bars, the open panes, and a band of its own beneath the mod. */
function engine(on: any, rows: object[], panes: object[], bars: object[] = []) {
  on('state.get', (_: any, e: any) => ({
    value: { value: e.key === 'agents' ? { rows, now: NOW } : { bars, now: NOW }, version: 1 },
  }))
  on('ui.panes', () => ({ value: panes }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

for (const surface of ['terminal', 'desktop', 'vscode', 'mobile']) {
  test(`the strip draws a running agent's character on ${surface} when no pane is open`, async ($, on) => {
    engine(on, [agent()], [])
    const ui = await $.ui.mount(band(surface))
    expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Build a maze/ })).toBeDefined()
    await ui.unmount()
  })
}

test('the model picks the anime in the strip', async ($, on) => {
  engine(on, [
    agent({ id: 'a', model: 'claude-sonnet-5-5' }), agent({ id: 'b', model: 'claude-haiku-5-5', type: 'Explore' }),
  ], [])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /Tanjiro/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Usopp/ })).toBeDefined()
  await ui.unmount()
})

test('a pane waiting undrawn on a narrow terminal leaves the strip up', async ($, on) => {
  engine(on, [agent()], [WAITING])
  const ui = await $.ui.mount(band('terminal'))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeDefined()
  await ui.unmount()
})

test('a pane on a terminal stands in for the strip', async ($, on) => {
  engine(on, [agent()], [PANE])
  const ui = await $.ui.mount(band('terminal'))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a placed pane does not hide the strip on the desktop', async ($, on) => {
  engine(on, [agent()], [PANE])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeDefined()
  await ui.unmount()
})

test('a finished agent stays a moment, then leaves', async ($, on) => {
  engine(on, [agent({ status: 'done', endedAt: NOW - 1000 })], [])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeDefined()
  await ui.unmount()
})

test('an agent that finished a while ago is gone', async ($, on) => {
  engine(on, [agent({ status: 'done', endedAt: NOW - 60_000 })], [])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a card no one has heard from in a long while does not hold the band', async ($, on) => {
  engine(on, [agent({ startedAt: NOW - 3_600_000, activeAt: NOW - 3_600_000 })], [])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('agents past the width are counted', async ($, on) => {
  engine(on, ['a', 'b', 'c', 'd', 'e'].map(id => agent({ id })), [])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /more/ })).toBeDefined()
  await ui.unmount()
})

test('a band too short for the strip keeps the progress bars', async ($, on) => {
  engine(on, [agent()], [], [progress])
  const ui = await $.ui.mount(band('desktop', 2))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /render/ })).toBeDefined()
  await ui.unmount()
})

test('the strip and the progress bars share the band', async ($, on) => {
  engine(on, [agent()], [], [progress])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Text', text: /Naruto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /render/ })).toBeDefined()
  await ui.unmount()
})
