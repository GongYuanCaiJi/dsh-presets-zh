/**
 * dsh-presets-zh core logic: locale resolution, the zh-preset roster, the
 * user-root materialization state machine, and the default-preset decision.
 *
 * Kept dependency-free (node builtins only) so the whole decision surface is
 * testable under `node --test` without a cordis context; src/index.js is the
 * thin cordis plugin that wires this into the host.
 */

import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** The four shipped presets and the ids their Chinese versions mount under. */
export const ZH_PRESETS = [
  { id: 'standard', target: 'standard-zh' },
  { id: 'cordis', target: 'cordis-zh' },
  { id: 'code', target: 'code-zh' },
  { id: 'minimal', target: 'minimal-zh' },
]

/** The default preset selected for Chinese locales. */
export const ZH_DEFAULT = 'standard-zh'

/** Marker file inside each materialized preset; holds the package version. */
export const MARKER_FILE = '.dsh-presets-zh'

/**
 * Resolve the effective locale from the persisted preference. The host's own
 * locale fallback is `zh` (packages/client/locale: FALLBACK_LOCALE), so only
 * an explicit `en` yields English; absence delegates to that fallback.
 * @param preference - `settings.locale.preference` (`'zh'` | `'en'` | absent).
 * @returns the effective locale id.
 */
export function resolveEffectiveLocale(preference) {
  return preference === 'en' ? 'en' : 'zh'
}

/**
 * Decide what to do with the agent-presets `default` setting.
 *
 * - zh locale, no explicit user pick, effective default still English → set
 *   the zh default (the user's own later pick always wins from then on).
 * - en locale with a default we set (user layer holds `standard-zh`) → revert
 *   by clearing the user layer, re-inheriting the deployment base.
 * - anything else → leave the setting alone.
 * @param input - effective locale, the user-layer default, and the resolved
 *   (user layer ?? deployment base) default.
 * @returns `{ action: 'set', value }`, `{ action: 'revert' }`, or `{ action: 'none' }`.
 */
export function decideDefault({ effectiveLocale, userDefault, currentDefault }) {
  if (effectiveLocale !== 'zh') {
    return userDefault === ZH_DEFAULT ? { action: 'revert' } : { action: 'none' }
  }
  if (userDefault !== undefined) return { action: 'none' }
  if (currentDefault === ZH_DEFAULT) return { action: 'none' }
  return { action: 'set', value: ZH_DEFAULT }
}

/** Whether every file under `shipped` exists at `target` with equal bytes. */
async function shippedFilesMatch(target, shipped) {
  const entries = await readdir(shipped, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const rel = relative(shipped, join(entry.parentPath, entry.name))
    const [shippedBytes, targetBytes] = await Promise.all([
      readFile(join(shipped, rel)),
      readFile(join(target, rel)).catch(() => null),
    ])
    if (targetBytes === null || !shippedBytes.equals(targetBytes)) return false
  }
  return true
}

/**
 * Classify one target preset directory against its shipped source.
 * @param targetDir - the preset's directory under the user root.
 * @param shippedDir - the corresponding directory inside this package.
 * @param version - this package's version (the marker value).
 * @returns `'missing' | 'current' | 'stale' | 'edited'`.
 */
export async function classifyPresetDir(targetDir, shippedDir, version) {
  try {
    await stat(targetDir)
  } catch {
    return 'missing'
  }
  let marker
  try {
    marker = JSON.parse(await readFile(join(targetDir, MARKER_FILE), 'utf8'))
  } catch {
    marker = undefined // ENOENT (or a broken marker) — treated as missing/stale
  }
  const filesMatch = await shippedFilesMatch(targetDir, shippedDir)
  if (!filesMatch) return 'edited'
  if (marker?.version === version) return 'current'
  return 'stale'
}

/**
 * Materialize one zh preset into the user root.
 *
 * The user root (`$DSH_HOME/.agent-presets`) is the host's sanctioned
 * authoring surface: shipped presets cannot be overwritten, and new ids are
 * created there (the same surface `agentPresets.copy()` writes to). The
 * preset is written when absent or when the package upgraded and the target is
 * still byte-identical to what we shipped; a user-edited preset is never
 * touched (the host's rule: copy a preset to a new id to customize it).
 * @param targetDir - destination directory (the preset id under the user root).
 * @param shippedDir - source directory inside this package.
 * @param version - package version stamped into the marker.
 * @returns `'written'` when the preset was (re)written, `'kept'` otherwise.
 */
export async function materializePreset(targetDir, shippedDir, version) {
  const state = await classifyPresetDir(targetDir, shippedDir, version)
  if (state === 'current' || state === 'edited') return 'kept'
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  for (const entry of await readdir(shippedDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const rel = relative(shippedDir, join(entry.parentPath, entry.name))
    const destination = join(targetDir, rel)
    await mkdir(join(destination, '..'), { recursive: true })
    await writeFile(destination, await readFile(join(shippedDir, rel)))
  }
  await writeFile(join(targetDir, MARKER_FILE), JSON.stringify({ version }))
  return 'written'
}

/**
 * Materialize every zh preset into the user root.
 * @param input - the user preset root, this package's shipped `presets/` dir,
 *   and the package version.
 * @returns the ids written and the ids kept as they were.
 */
export async function syncZhPresets({ userRoot, shippedRoot, version }) {
  const written = []
  const kept = []
  for (const { id, target } of ZH_PRESETS) {
    const outcome = await materializePreset(
      join(userRoot, target),
      join(shippedRoot, id),
      version,
    )
    ;(outcome === 'written' ? written : kept).push(target)
  }
  return { written, kept }
}
