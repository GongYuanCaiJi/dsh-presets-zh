/**
 * Translation-anchor tests.
 *
 * Each shipped Chinese preset must satisfy the anchor against its vendored
 * upstream original: same line count, same line categories, byte-identical
 * structural lines, identical prose-key prefixes, and equal paragraph counts.
 * This is the replacement trust anchor for a translation (see
 * THIRD_PARTY_NOTICES.md), and the same logic runs in `scripts/verify-shipped.mjs`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { anchorCheck, countParagraphs, PRESET_IDS } from '../scripts/anchor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// The loader's YAML dialect: js-yaml with a `!!js` scalar type (the
// `entryListSchema` from cordis-plugin-include). A translated composition must
// parse under the same dialect the preset loader uses.
const JsExpr = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: value => value })
const LOADER_SCHEMA = yaml.DEFAULT_SCHEMA.extend([JsExpr])

for (const id of PRESET_IDS) {
  test(`translation anchor: ${id}`, async () => {
    const original = await readFile(join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'), 'utf8')
    const translated = await readFile(join(ROOT, 'presets', id, 'agent.cordis.yml'), 'utf8')

    const violations = anchorCheck(original, translated)
    assert.deepEqual(violations, [], violations.join('\n'))

    // The ticket's explicit paragraph-count anchor, asserted independently.
    assert.equal(
      countParagraphs(translated),
      countParagraphs(original),
      `paragraph count must equal the original for ${id}`,
    )

    // Tie the one-to-one mapping table in THIRD_PARTY_NOTICES.md to the files:
    // the absolute paragraph counts published there must hold.
    const TABLE = { standard: 42, cordis: 46, code: 44, minimal: 7 }
    assert.equal(countParagraphs(original), TABLE[id], `notices table must match ${id}`)

    // The translation must be a loadable entry list under the loader dialect.
    const rows = yaml.load(translated, { schema: LOADER_SCHEMA })
    assert.ok(Array.isArray(rows) && rows.length > 0, `${id}: composition must parse to a non-empty entry list`)
    for (const row of rows) {
      assert.equal(typeof row.id, 'string', `${id}: every row needs an id`)
      assert.equal(typeof row.name, 'string', `${id}: row ${row.id} needs a plugin name`)
    }
  })

  test(`shipped preset metadata is byte-identical for ${id}`, async () => {
    // preset.yml is already Chinese upstream; the zh preset ships it verbatim.
    const original = await readFile(join(ROOT, 'upstream', 'agent-presets', id, 'preset.yml'), 'utf8')
    const shipped = await readFile(join(ROOT, 'presets', id, 'preset.yml'), 'utf8')
    assert.equal(shipped, original)
  })
}
