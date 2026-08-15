/**
 * Bilingual-pair record tests.
 *
 * The trust anchor (see THIRD_PARTY_NOTICES.md) is the upstream
 * deepseek-harness convention: each translation pair carries a
 * `<stem>.i18n.yaml` consistency record pinning the full git blob hash of
 * both sides as of the last confirmed-consistent state. These tests assert
 * (a) the blob-hash primitive matches `git hash-object` semantics, (b) the
 * records pin the current contents of both sides — so editing either side
 * without re-recording goes red, and (c) the gate is fail-closed on either
 * side drifting or on a missing record key.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  gitBlobHash,
  parsePairRecord,
  recordWith,
  verifyPair,
  verifyPresets,
  ORIGINAL_KEY,
  TRANSLATION_KEY,
} from '../scripts/verify-pairs.mjs'
import { PRESET_IDS } from '../scripts/anchor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('gitBlobHash matches git hash-object semantics', () => {
  // sha1("blob <byte size>\0<bytes>") — the classic vectors.
  assert.equal(gitBlobHash(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  assert.equal(gitBlobHash('hello world\n'), '3b18e512dba79e4c8300dd08aeb37f8e728b8dad')
  // Byte size, not UTF-16 code-unit count: a CJK char must count as 3 bytes.
  const cjk = gitBlobHash('你好\n')
  assert.equal(cjk.length, 40)
  assert.notEqual(cjk, gitBlobHash('𠮷\n')) // 4-byte char vs 3-byte char, same code-unit length
})

test('parsePairRecord reads only name: <40-hex blob> lines', () => {
  const record = parsePairRecord(`# comment line
# another comment
agent.cordis.yml: ${'a'.repeat(40)}
agent.cordis.zh.yml: ${'b'.repeat(40)}
trailing: not-a-blob
`)
  assert.deepEqual(record, {
    [ORIGINAL_KEY]: 'a'.repeat(40),
    [TRANSLATION_KEY]: 'b'.repeat(40),
  })
})

test('recordWith rewrites hash lines and keeps the header byte-identical', () => {
  const header = '# kept comment\n# more\n'
  const before = `${header}${ORIGINAL_KEY}: ${'a'.repeat(40)}\n${TRANSLATION_KEY}: ${'b'.repeat(40)}\n`
  const after = recordWith(before, {
    [ORIGINAL_KEY]: 'c'.repeat(40),
    [TRANSLATION_KEY]: 'd'.repeat(40),
  })
  assert.equal(after, `${header}${ORIGINAL_KEY}: ${'c'.repeat(40)}\n${TRANSLATION_KEY}: ${'d'.repeat(40)}\n`)
})

for (const id of PRESET_IDS) {
  test(`pair record ${id}: pins the current blob of both sides`, async () => {
    const record = parsePairRecord(await readFile(join(ROOT, 'pairs', `${id}.i18n.yaml`), 'utf8'))
    const keys = Object.keys(record).sort()
    assert.deepEqual(keys, [ORIGINAL_KEY, TRANSLATION_KEY].sort(), `${id}: record must carry exactly the two pair keys`)
    for (const value of Object.values(record)) assert.match(value, /^[0-9a-f]{40}$/)

    const original = await readFile(join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'), 'utf8')
    const translated = await readFile(join(ROOT, 'presets', id, 'agent.cordis.yml'), 'utf8')
    // The fail-closed condition: current tree equals the record. A translation
    // edit (or a re-vendor) without re-recording fails npm test here.
    assert.equal(gitBlobHash(original), record[ORIGINAL_KEY], `${id}: vendored original drifted from the record`)
    assert.equal(gitBlobHash(translated), record[TRANSLATION_KEY], `${id}: translation drifted from the record`)
  })

  test(`verifyPair ${id}: hash equality + structure signature pass`, async () => {
    const [original, translated, record] = await Promise.all([
      readFile(join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'), 'utf8'),
      readFile(join(ROOT, 'presets', id, 'agent.cordis.yml'), 'utf8'),
      readFile(join(ROOT, 'pairs', `${id}.i18n.yaml`), 'utf8').then(parsePairRecord),
    ])
    assert.deepEqual(verifyPair(original, translated, record), [])
  })

  test(`verifyPair ${id} is fail-closed on either side`, async () => {
    const original = await readFile(join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'), 'utf8')
    const translated = await readFile(join(ROOT, 'presets', id, 'agent.cordis.yml'), 'utf8')
    const record = parsePairRecord(await readFile(join(ROOT, 'pairs', `${id}.i18n.yaml`), 'utf8'))

    // Drift on the original side.
    const driftedOriginal = verifyPair(`${original}# tampered`, translated, record)
    assert.ok(driftedOriginal.some(e => e.startsWith(ORIGINAL_KEY)), `${id}: original drift must report ${ORIGINAL_KEY}`)

    // Drift on the translation side — the case the old anchor could not see.
    const driftedTranslation = verifyPair(original, `${translated}# tampered`, record)
    assert.ok(driftedTranslation.some(e => e.startsWith(TRANSLATION_KEY)), `${id}: translation drift must report ${TRANSLATION_KEY}`)

    // Missing record key fails closed.
    const missingKey = verifyPair(original, translated, { [ORIGINAL_KEY]: record[ORIGINAL_KEY] })
    assert.ok(missingKey.some(e => e.includes('missing')), `${id}: a record without ${TRANSLATION_KEY} must fail`)
  })
}

test('verifyPresets scans the whole roster without violations', async () => {
  assert.deepEqual(await verifyPresets(), [])
})