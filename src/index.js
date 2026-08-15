/**
 * dsh-presets-zh plugin: load the Chinese factory agent presets by locale.
 *
 * Mounted as a `dsh.bundle` patch row (`cordis.patch.yml`). On boot — and on
 * every `settings/updated` change to the locale or preset-default settings —
 * it:
 *
 * 1. resolves the effective locale (`settings.locale.preference`, whose
 *    absence falls back to `zh`, matching the host's own FALLBACK_LOCALE);
 * 2. materializes the four Chinese presets (`standard-zh`, `cordis-zh`,
 *    `code-zh`, `minimal-zh`) into the harness-home user preset root
 *    (`$DSH_HOME/.agent-presets`) — the same authoring surface
 *    `agentPresets.copy()` writes to. A user-edited preset is never
 *    overwritten (the host rule: copy a preset to a new id to customize it);
 * 3. selects `standard-zh` as the preset default only when the effective
 *    locale is Chinese and the user has not picked a default of their own;
 *    switching the locale back to English reverts exactly that pick.
 *
 * The decision and filesystem logic lives in src/logic.mjs (unit-tested under
 * `node --test`); this file is the thin host wiring.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  decideDefault,
  resolveEffectiveLocale,
  syncZhPresets,
} from './logic.mjs'

/** Cordis plugin name. */
export const name = 'presets-zh'

const LOCALE_NS = 'locale'
const PRESET_SETTINGS_NS = 'agent-presets'

/** This package's version, stamped into each materialized preset marker. */
function packageVersion() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
}

/** The user preset root this deployment actually scans, or undefined. */
function userPresetRoot(agentPresets) {
  return agentPresets.roots.find(root => root.trust === 'user')?.path
}

/**
 * Materialize the zh presets and reconcile the preset default with the
 * current locale. Idempotent; safe to run on every boot and on settings
 * changes.
 * @param scoped - a context where `settings` and `agentPresets` resolve.
 */
async function sync(scoped) {
  const version = packageVersion()
  const userRoot = userPresetRoot(scoped.agentPresets)
  if (userRoot === undefined) return
  const shippedRoot = fileURLToPath(new URL('../presets/', import.meta.url))

  const effectiveLocale = resolveEffectiveLocale(
    scoped.settings.get(settingsNamespace(LOCALE_NS))?.preference,
  )

  await syncZhPresets({ userRoot, shippedRoot, version })

  const described = scoped.settings.describe()
    .find(entry => String(entry.ns) === PRESET_SETTINGS_NS)
  const userDefault = described?.user?.default
  const currentDefault = scoped.settings.get(settingsNamespace(PRESET_SETTINGS_NS))?.default
  const decision = decideDefault({ effectiveLocale, userDefault, currentDefault })

  if (decision.action === 'set') {
    await scoped.settings.update(settingsNamespace(PRESET_SETTINGS_NS), { default: decision.value })
  } else if (decision.action === 'revert') {
    await scoped.settings.replace(settingsNamespace(PRESET_SETTINGS_NS), {})
  }
}

/**
 * Mount the plugin: initial sync plus live re-sync on locale/default changes.
 * Failures are logged, never fatal — a broken sync must not take the profile
 * down.
 * @param ctx - the mounting profile context.
 */
export function apply(ctx) {
  ctx.inject(['settings', 'agentPresets'], (scoped) => {
    const run = () => {
      void sync(scoped).catch(error => {
        ctx.logger?.warn(`dsh-presets-zh: sync failed: ${String(error)}`)
      })
    }
    run()
    ctx.on('settings/updated', ns => {
      const key = String(ns)
      if (key === LOCALE_NS || key === PRESET_SETTINGS_NS) run()
    })
  })
}