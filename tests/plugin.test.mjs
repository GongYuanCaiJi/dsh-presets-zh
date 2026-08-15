/**
 * Plugin logic tests: locale resolution, default-preset decision, and the
 * user-root materialization state machine. All logic lives in src/logic.mjs
 * as pure functions or fs functions over explicit directories, so every test
 * runs against real temp directories — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import {
  resolveEffectiveLocale,
  decideDefault,
  classifyPresetDir,
  materializePreset,
  syncZhPresets,
  ZH_PRESETS,
  ZH_DEFAULT,
  MARKER_FILE,
} from '../src/logic.mjs'

test('resolveEffectiveLocale mirrors the host fallback (zh)', () => {
  assert.equal(resolveEffectiveLocale('zh'), 'zh')
  assert.equal(resolveEffectiveLocale('en'), 'en')
  // Absent preference delegates to the browser, whose fallback is zh.
  assert.equal(resolveEffectiveLocale(undefined), 'zh')
  assert.equal(resolveEffectiveLocale(null), 'zh')
  // Any non-en preference lands on zh, matching FALLBACK_LOCALE.
  assert.equal(resolveEffectiveLocale('fr'), 'zh')
})

test('decideDefault: zh with no user pick switches the English default', () => {
  assert.deepEqual(
    decideDefault({ effectiveLocale: 'zh', userDefault: undefined, currentDefault: 'standard' }),
    { action: 'set', value: ZH_DEFAULT },
  )
})

test('decideDefault: never fights an explicit user pick', () => {
  for (const userDefault of ['standard-zh', 'minimal', 'code']) {
    assert.deepEqual(
      decideDefault({ effectiveLocale: 'zh', userDefault, currentDefault: userDefault }),
      { action: 'none' },
      `user default ${userDefault} must be respected`,
    )
  }
})

test('decideDefault: already on the zh default is a no-op', () => {
  assert.deepEqual(
    decideDefault({ effectiveLocale: 'zh', userDefault: undefined, currentDefault: ZH_DEFAULT }),
    { action: 'none' },
  )
})

test('decideDefault: en reverts only the default we set', () => {
  assert.deepEqual(
    decideDefault({ effectiveLocale: 'en', userDefault: ZH_DEFAULT, currentDefault: ZH_DEFAULT }),
    { action: 'revert' },
  )
  assert.deepEqual(
    decideDefault({ effectiveLocale: 'en', userDefault: 'minimal', currentDefault: 'minimal' }),
    { action: 'none' },
  )
  assert.deepEqual(
    decideDefault({ effectiveLocale: 'en', userDefault: undefined, currentDefault: 'standard' }),
    { action: 'none' },
  )
})

/** Build one shipped preset dir: composition + metadata + a nested skill. */
async function seedShipped(root, id) {
  const dir = join(root, id)
  await mkdir(join(dir, 'skills', 'demo'), { recursive: true })
  await writeFile(join(dir, 'agent.cordis.yml'), `# ${id} composition\n- id: persona\n`)
  await writeFile(join(dir, 'preset.yml'), `name: ${id}\n`)
  await writeFile(join(dir, 'skills', 'demo', 'SKILL.md'), `# ${id} skill\n`)
  return dir
}

/** Copy the shipped tree into target with a marker at `version` (or none). */
async function seedTarget(target, shipped, version) {
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  const entries = await readdir(shipped, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const rel = relative(shipped, join(entry.parentPath, entry.name))
    const full = await readFile(join(shipped, rel))
    await mkdir(join(target, rel).replace(/[^/]+$/, ''), { recursive: true })
    await writeFile(join(target, rel), full)
  }
  if (version !== undefined) {
    await writeFile(join(target, MARKER_FILE), JSON.stringify({ version }))
  }
}

test('classifyPresetDir: the four states', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-zh-classify-'))
  const shipped = await seedShipped(root, 'src')
  const target = join(root, 'target')

  assert.equal(await classifyPresetDir(target, shipped, '0.1.0'), 'missing')

  await seedTarget(target, shipped, '0.1.0')
  assert.equal(await classifyPresetDir(target, shipped, '0.1.0'), 'current')

  await seedTarget(target, shipped, '0.0.9')
  assert.equal(await classifyPresetDir(target, shipped, '0.1.0'), 'stale')

  await seedTarget(target, shipped, '0.1.0')
  await writeFile(join(target, 'agent.cordis.yml'), '# user edited\n')
  assert.equal(await classifyPresetDir(target, shipped, '0.1.0'), 'edited')
  await writeFile(join(target, MARKER_FILE), JSON.stringify({ version: '0.0.9' }))
  assert.equal(await classifyPresetDir(target, shipped, '0.1.0'), 'edited')
})

test('materializePreset: missing and stale write; current and edited keep', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-zh-materialize-'))
  const shipped = await seedShipped(root, 'src')
  const target = join(root, 'target')

  assert.equal(await materializePreset(target, shipped, '0.1.0'), 'written')
  assert.deepEqual(
    await readFile(join(target, 'agent.cordis.yml'), 'utf8'),
    await readFile(join(shipped, 'agent.cordis.yml'), 'utf8'),
  )
  assert.equal(
    JSON.parse(await readFile(join(target, MARKER_FILE), 'utf8')).version,
    '0.1.0',
  )
  // Nested skill travelled with the preset.
  assert.equal((await readdir(join(target, 'skills', 'demo')))[0], 'SKILL.md')

  // current -> kept, bytes untouched
  assert.equal(await materializePreset(target, shipped, '0.1.0'), 'kept')

  // stale -> rewritten
  await writeFile(join(target, MARKER_FILE), JSON.stringify({ version: '0.0.9' }))
  assert.equal(await materializePreset(target, shipped, '0.1.0'), 'written')

  // user edit -> kept, edit survives
  await writeFile(join(target, 'agent.cordis.yml'), '# user edited\n')
  assert.equal(await materializePreset(target, shipped, '0.1.0'), 'kept')
  assert.equal(await readFile(join(target, 'agent.cordis.yml'), 'utf8'), '# user edited\n')
})

test('syncZhPresets materializes all four pairs under the user root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-zh-sync-'))
  const userRoot = join(root, '.agent-presets')
  const shippedRoot = join(root, 'shipped')
  for (const { id } of ZH_PRESETS) await seedShipped(shippedRoot, id)

  const first = await syncZhPresets({ userRoot, shippedRoot, version: '0.1.0' })
  assert.equal(first.written.length, ZH_PRESETS.length)
  assert.equal(first.kept.length, 0)

  const second = await syncZhPresets({ userRoot, shippedRoot, version: '0.1.0' })
  assert.equal(second.written.length, 0)
  assert.equal(second.kept.length, ZH_PRESETS.length)

  for (const { id, target } of ZH_PRESETS) {
    assert.equal(
      await readFile(join(userRoot, target, 'agent.cordis.yml'), 'utf8'),
      await readFile(join(shippedRoot, id, 'agent.cordis.yml'), 'utf8'),
    )
  }
})

test('zh preset roster is the four shipped ids', () => {
  assert.deepEqual(
    ZH_PRESETS.map(({ id, target }) => target),
    ['standard-zh', 'cordis-zh', 'code-zh', 'minimal-zh'],
  )
  assert.equal(ZH_DEFAULT, 'standard-zh')
})
