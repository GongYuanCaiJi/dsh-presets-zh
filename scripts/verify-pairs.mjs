#!/usr/bin/env node
/**
 * Bilingual-pair consistency gate for dsh-presets-zh.
 *
 * Mirrors the upstream deepseek-ai/deepseek-harness contract
 * (docs/i18n/README.md, scripts/verify-translation-pairing.ts,
 * packages/preset/agent-presets/README.i18n.yaml) at the pinned revision
 * 47f943859bef60e4160492346772ded9b24f765a: a translation pair is confirmed
 * consistent at exactly the contents recorded in its <stem>.i18n.yaml
 * consistency record, which pins the full git blob hash of each side as of
 * the last confirmation. The upstream tool is markdown-only (heading/table/
 * list structure signatures, language switchers, .zh.md gates) and cannot
 * consume these YAML system prompts, so this port self-produces the verifier
 * in the same shape:
 *
 *   1. hash equality — the current git blob hash of each side (git
 *      hash-object semantics, computed hermetically) must equal the recorded
 *      one; editing either side without re-confirming the pair goes red;
 *   2. structure signature — the translation must keep the anchor against the
 *      original (same line count, same line categories, byte-identical
 *      structural lines, same paragraph count; see scripts/anchor.mjs).
 *
 * Any violation exits non-zero (fail-closed). `--write` re-records both
 * hashes from the current tree — blessing the current contents as the new
 * confirmed state after a confirmed re-translation — and refuses to bless a
 * pair whose structure has drifted or whose record is missing. Preset ids or
 * any of a pair's file paths select a subset; no arguments verify the whole
 * roster.
 *
 * npm test runs the same checks via tests/pairs.test.mjs; `prepare` runs them
 * via scripts/verify-shipped.mjs.
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anchorCheck, PRESET_IDS } from './anchor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Record keys, upstream style: plain file name + .zh twin. */
export const ORIGINAL_KEY = 'agent.cordis.yml'
export const TRANSLATION_KEY = 'agent.cordis.zh.yml'

/** Git blob hash of a file's content: sha1 of "blob <byte size>\0<bytes>". */
export function gitBlobHash(content) {
  return createHash('sha1').update(`blob ${Buffer.byteLength(content, 'utf8')}\0`).update(content, 'utf8').digest('hex')
}

/**
 * Parse a <stem>.i18n.yaml record. Only `name: <40-hex blob>` lines count;
 * comment lines and blanks are ignored, so the record files stay readable.
 * @param {string} text - record file content.
 * @returns {Record<string, string>}
 */
export function parsePairRecord(text) {
  const record = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Za-z0-9._/-]+):\s*([0-9a-f]{40})\s*$/)
    if (match) record[match[1]] = match[2]
  }
  return record
}

/**
 * Rewrite a record's hash lines, keeping every other line (header comments,
 * blanks) byte-identical; missing keys are appended at the end.
 * @param {string} recordText - existing record file content.
 * @param {Record<string, string>} record - new `key: blob` values.
 * @returns {string}
 */
export function recordWith(recordText, record) {
  const seen = new Set()
  const lines = recordText.split('\n').map(line => {
    const match = line.match(/^([A-Za-z0-9._/-]+):\s*([0-9a-f]{40})\s*$/)
    if (match && Object.hasOwn(record, match[1])) {
      seen.add(match[1])
      return `${match[1]}: ${record[match[1]]}`
    }
    return line
  })
  for (const key of Object.keys(record)) {
    if (!seen.has(key)) lines.push(`${key}: ${record[key]}`)
  }
  return lines.join('\n')
}

/**
 * The structure signature between the two sides: the translation keeps the
 * translation anchor against the original. Structure is a property of the
 * pair itself, independent of the record.
 * @param {string} original - upstream original content (vendored).
 * @param {string} translated - this port's translation content.
 * @returns {string[]} violations; empty when the pair is consistent.
 */
export function verifyStructure(original, translated) {
  const errors = []
  const structure = anchorCheck(original, translated)
  if (structure.length > 0) {
    errors.push(`structure signature violated:\n    ${structure.join('\n    ')}`)
  }
  return errors
}

/**
 * Hash equality: each side's current blob hash must equal its recorded one.
 * Pure content comparison — record values are git blob hashes, so the check
 * is hermetic.
 * @param {string} original - upstream original content (vendored).
 * @param {string} translated - this port's translation content.
 * @param {Record<string, string>} record - parsed <stem>.i18n.yaml.
 * @returns {string[]} violations; empty when the pair is consistent.
 */
export function verifyHashes(original, translated, record) {
  const errors = []
  const originalBlob = gitBlobHash(original)
  const translatedBlob = gitBlobHash(translated)
  if (!Object.hasOwn(record, ORIGINAL_KEY)) {
    errors.push(`record is missing ${ORIGINAL_KEY}`)
  } else if (originalBlob !== record[ORIGINAL_KEY]) {
    errors.push(`${ORIGINAL_KEY}: blob ${originalBlob} no longer matches the recorded ${record[ORIGINAL_KEY]}`)
  }
  if (!Object.hasOwn(record, TRANSLATION_KEY)) {
    errors.push(`record is missing ${TRANSLATION_KEY}`)
  } else if (translatedBlob !== record[TRANSLATION_KEY]) {
    errors.push(`${TRANSLATION_KEY}: blob ${translatedBlob} no longer matches the recorded ${record[TRANSLATION_KEY]}`)
  }
  return errors
}

/** Full pair check: structure signature on both sides, then hash equality. */
export function verifyPair(original, translated, record) {
  return [...verifyStructure(original, translated), ...verifyHashes(original, translated, record)]
}

function pairPaths(id) {
  return {
    original: join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'),
    translated: join(ROOT, 'presets', id, 'agent.cordis.yml'),
    record: join(ROOT, 'pairs', `${id}.i18n.yaml`),
  }
}

/**
 * Verify the roster (or a subset) against its records. With `write`, re-record
 * every structure-consistent pair's hashes from the current tree — blessing
 * the current contents as the new confirmed state. A structurally drifted pair,
 * or one whose record is missing, is never re-recorded: report and fail closed.
 * @param {{ write?: boolean, ids?: string[] }} opts
 * @returns {Promise<string[]>} violations across the roster.
 */
export async function verifyPresets({ write = false, ids = PRESET_IDS } = {}) {
  const errors = []
  for (const id of ids) {
    const { original: originalPath, translated: translatedPath, record: recordPath } = pairPaths(id)
    const original = await readFile(originalPath, 'utf8')
    const translated = await readFile(translatedPath, 'utf8')
    let recordText
    try {
      recordText = await readFile(recordPath, 'utf8')
    } catch {
      recordText = undefined
    }

    // The structure signature always gates, in both modes.
    const structure = verifyStructure(original, translated)
    if (structure.length > 0) {
      for (const violation of structure) errors.push(`${id}: ${violation}`)
      continue
    }
    if (recordText === undefined) {
      errors.push(`${id}: consistency record pairs/${id}.i18n.yaml is missing`)
      continue
    }
    const record = parsePairRecord(recordText)

    if (!write) {
      for (const violation of verifyHashes(original, translated, record)) errors.push(`${id}: ${violation}`)
      continue
    }
    const next = {
      [ORIGINAL_KEY]: gitBlobHash(original),
      [TRANSLATION_KEY]: gitBlobHash(translated),
    }
    await writeFile(recordPath, recordWith(recordText, next))
  }
  return errors
}

// CLI ----------------------------------------------------------------

const args = process.argv.slice(2)
const write = args.includes('--write')
const selectors = args.filter(arg => !arg.startsWith('--'))

let ids = PRESET_IDS
if (selectors.length > 0) {
  const unknown = selectors.filter(selector => !PRESET_IDS.includes(selector) && !selector.split('/').some(part => PRESET_IDS.includes(part)))
  if (unknown.length > 0) {
    process.stderr.write(`verify-pairs: unknown preset selector(s): ${unknown.join(', ')} (roster: ${PRESET_IDS.join(', ')}; or a path inside one of the pairs)\n`)
    process.exit(2)
  }
  ids = PRESET_IDS.filter(id => selectors.some(selector => selector === id || selector.split('/').includes(id)))
}

const violations = await verifyPresets({ write, ids })
if (violations.length > 0) {
  process.stderr.write('verify-pairs: bilingual pairing rules violated (see THIRD_PARTY_NOTICES.md):\n')
  for (const violation of violations) process.stderr.write(`  ${violation}\n`)
  process.exit(1)
}
const action = write ? 're-recorded and verified' : 'verified'
process.stdout.write(
  `verify-pairs: ${ids.length} preset pair(s) ${action} against the recorded git blob hashes (hash equality + structure signature).\n`,
)