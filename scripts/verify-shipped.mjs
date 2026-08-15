#!/usr/bin/env node
/**
 * Shipped-asset integrity check, run by `prepare` / `prepack` and by CI.
 *
 * Primary anchor: every shipped Chinese preset is consistent with its
 * bilingual-pair consistency record (`pairs/<id>.i18n.yaml`, the upstream
 * deepseek-harness convention) — the git blob hash of each side must equal
 * the recorded one, and the translation must keep the anchor against its
 * vendored original (structure signature). Supporting evidence: the vendored
 * originals still match the SHA-256 table in THIRD_PARTY_NOTICES.md, and the
 * shipped preset files exist. Exits non-zero on any violation, so an install
 * (github: prepare) or a publish (prepack) of a broken package fails loud.
 */

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anchorCheck, PRESET_IDS } from './anchor.mjs'
import { verifyPresets } from './verify-pairs.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** SHA-256 of the four originals, pinned in THIRD_PARTY_NOTICES.md. */
const PINNED_SHA = {
  standard: 'cb98756a9ed76ca351a45a0ba138a97bf0ab7eead4fe2f1e9d1c9f9ec97937f0',
  cordis: '16ad73eabe064f33056924c7157b944a74425ce9b6b5e9b8d910d369d9e15ed8',
  code: '749da0d93d3824bc4a227b6ead38c99b4247e63108e48bd5fc661b463da00077',
  minimal: 'cacb47f09a88985c8eb0906a62e6883205727a3c8db901807cb03f936b863cca',
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

const failures = []

// Primary anchor: bilingual-pair records (hash equality both sides + structure
// signature). A translation edit without re-recording fails here.
const pairViolations = await verifyPresets()
for (const violation of pairViolations) {
  failures.push(`pair record: ${violation}`)
}

for (const id of PRESET_IDS) {
  const original = await readFile(join(ROOT, 'upstream', 'agent-presets', id, 'agent.cordis.yml'), 'utf8')
  const translated = await readFile(join(ROOT, 'presets', id, 'agent.cordis.yml'), 'utf8')

  const actual = sha256(original)
  if (actual !== PINNED_SHA[id]) {
    failures.push(`${id}: vendored original SHA-256 ${actual} does not match the pinned ${PINNED_SHA[id]}`)
  }

  const violations = anchorCheck(original, translated)
  if (violations.length > 0) {
    failures.push(`${id}: translation anchor violated:\n  ${violations.join('\n  ')}`)
  }

  const shippedFiles = await readdir(join(ROOT, 'presets', id))
  if (!shippedFiles.includes('agent.cordis.yml') || !shippedFiles.includes('preset.yml')) {
    failures.push(`${id}: shipped preset is missing agent.cordis.yml or preset.yml`)
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`dsh-presets-zh: ${failure}\n`)
  process.exit(1)
}
process.stdout.write(
  `dsh-presets-zh: ${PRESET_IDS.length} presets consistent with their bilingual-pair records (git blob hashes) and the pinned upstream revision.\n`,
)
