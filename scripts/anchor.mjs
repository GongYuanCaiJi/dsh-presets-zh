/**
 * Translation anchor for dsh-presets-zh.
 *
 * A translation is not a verbatim copy, so the "identical bytes" trust anchor
 * does not apply. The replacement anchor, enforced here, is:
 *
 *   1. same line count;
 *   2. same per-line category at every position — blank / comment /
 *      prose-key / block-prose / structural;
 *   3. byte-identical structural lines (row ids, plugin names, config keys,
 *      `!!js` expressions, indentation);
 *   4. identical prose-key prefixes (the `text: >-` / `section: |` parts),
 *      so only the value inside a prose line may differ;
 *   5. same paragraph count (blank-line-separated blocks).
 *
 * Categories are computed with the same state machine on both sides, so a
 * structural drift on either side fails the check.
 */

const PROSE_KEY = /^(\s*)(text|section|description)(\s*):(\s*)(\|[+-]?|>[+-]?)?/
const BLOCK_MARKER = /^(\s*)(text|section|description)(\s*):(\s*)(\|[+-]?|>[+-]?)(\s*)$/

/** Indentation of a non-blank line (column of its first non-space char). */
function indentOf(line) {
  return line.length - line.trimStart().length
}

/**
 * Classify every line of one file into `blank | comment | prose-key |
 * block-prose | structural`. Block-prose tracking is per-file state, so both
 * sides run the same machine over their own text.
 * @param {string} text - file content.
 * @returns {Array<{cat: string, line: string, prefix?: string}>}
 */
export function classifyLines(text) {
  const lines = text.split('\n')
  const out = []
  let blockIndent = null
  for (const line of lines) {
    const trimmed = line.trim()
    let cat
    let prefix
    if (trimmed === '') {
      cat = 'blank'
    } else if (trimmed.startsWith('#')) {
      cat = 'comment'
    } else if (blockIndent !== null && indentOf(line) > blockIndent) {
      cat = 'block-prose'
    } else if (BLOCK_MARKER.test(line)) {
      cat = 'prose-key'
      blockIndent = indentOf(line)
    } else if (PROSE_KEY.test(line)) {
      cat = 'prose-key'
      prefix = line.match(PROSE_KEY)[0]
    } else {
      cat = 'structural'
      if (blockIndent !== null) blockIndent = null
    }
    out.push({ cat, line, ...(prefix === undefined ? {} : { prefix }) })
  }
  return out
}

/** Blank-line-separated blocks, ignoring a trailing empty block. */
export function countParagraphs(text) {
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim() !== '')
  return blocks.length
}

/**
 * Compare one original/translation pair against the anchor.
 * @param {string} original - upstream English file content.
 * @param {string} translated - Chinese translation content.
 * @returns {string[]} human-readable violations; empty when the pair passes.
 */
export function anchorCheck(original, translated) {
  const errors = []
  const a = classifyLines(original)
  const b = classifyLines(translated)
  if (a.length !== b.length) {
    errors.push(`line count differs: ${a.length} (original) vs ${b.length} (translation)`)
  }
  const common = Math.min(a.length, b.length)
  for (let i = 0; i < common; i++) {
    const x = a[i]
    const y = b[i]
    if (x.cat !== y.cat) {
      errors.push(`line ${i + 1}: category ${x.cat} (original) vs ${y.cat} (translation)`)
      continue
    }
    if (x.cat === 'structural' && x.line !== y.line) {
      errors.push(`line ${i + 1}: structural line differs`)
    }
    if (x.cat === 'prose-key') {
      const xp = x.prefix ?? x.line
      const yp = y.prefix ?? y.line
      if (xp !== yp) errors.push(`line ${i + 1}: prose key differs (${JSON.stringify(xp)} vs ${JSON.stringify(yp)})`)
    }
  }
  const pa = countParagraphs(original)
  const pb = countParagraphs(translated)
  if (pa !== pb) {
    errors.push(`paragraph count differs: ${pa} (original) vs ${pb} (translation)`)
  }
  return errors
}

/** The four preset ids the translation covers, in roster order. */
export const PRESET_IDS = ['standard', 'cordis', 'code', 'minimal']
