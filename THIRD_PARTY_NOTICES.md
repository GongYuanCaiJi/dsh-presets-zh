# Third-Party Notices

This package is a **translation** of the factory agent-preset system prompts
shipped by the upstream project. Because a translation is not a verbatim copy,
the "identical bytes + hash" trust anchor does not apply. Instead, this file
pins the exact upstream revision and file hashes, and provides a one-to-one
mapping plus copyable verification commands so anyone can confirm that (a) the
translation was made from exactly this upstream revision, and (b) no paragraph
was added or removed.

## Upstream

| | |
|---|---|
| Project | [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) |
| License | MIT |
| Translated revision | `47f943859bef60e4160492346772ded9b24f765a` (2026-08-13, merge of `feat/npm-public`) |
| Source files | `apps/cli/config/agent-presets/{standard,cordis,code,minimal}/agent.cordis.yml` at that revision |
| Fetch path | `https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/config/agent-presets/<id>/agent.cordis.yml` |

The four originals are vendored in this repository under `upstream/agent-presets/`
for hermetic verification; their SHA-256 below is computed from the pinned
revision, and the verification command re-fetches from GitHub and re-checks.

## Original file hashes (SHA-256, from the pinned revision)

| Original file | SHA-256 |
|---|---|
| `standard/agent.cordis.yml` | `cb98756a9ed76ca351a45a0ba138a97bf0ab7eead4fe2f1e9d1c9f9ec97937f0` |
| `cordis/agent.cordis.yml` | `16ad73eabe064f33056924c7157b944a74425ce9b6b5e9b8d910d369d9e15ed8` |
| `code/agent.cordis.yml` | `749da0d93d3824bc4a227b6ead38c99b4247e63108e48bd5fc661b463da00077` |
| `minimal/agent.cordis.yml` | `cacb47f09a88985c8eb0906a62e6883205727a3c8db901807cb03f936b863cca` |
| `standard/preset.yml` | `3c61b4ce68e5dd5cb2c099693fdcb30b91d5f22bbbef546e233321b0fa68f0e4` |
| `cordis/preset.yml` | `7c5f009d82dda01b0e3b4e24c143eaa988f275a8322719800a574bd05c72c0da` |
| `code/preset.yml` | `ec3e1d288532a96dc35fd96c16c08ea6fd92893323039018f71a37988fc72580` |
| `minimal/preset.yml` | `f33f87aab99479706b9b969bc88090783ec7eb1390ab37d562618358a00a83fe` |
| `cordis/skills/editing-cordis-compositions/SKILL.md` | `8e3081ec066ffe07097e2b9c610c39dca831c7f6bb34dc53f1536be85606e604` |
| `cordis/skills/cordis-plugin-development/SKILL.md` | `01811d3ee9c03a466abae12d54d229e7de7bd74ca6b730c54ce9d5e696b294aa` |

## One-to-one mapping

Each original system-prompt file maps to exactly one translated file. The
translation preserves the original line structure: same line count, same
comment/prose/structural line positions, byte-identical structural lines
(row ids, plugin names, config keys, `!!js` expressions), and therefore the
same number of paragraphs.

| Original | Translated | Original paragraphs | Translated paragraphs |
|---|---|---|---|
| `upstream/agent-presets/standard/agent.cordis.yml` | `presets/standard/agent.cordis.yml` | 42 | 42 |
| `upstream/agent-presets/cordis/agent.cordis.yml` | `presets/cordis/agent.cordis.yml` | 46 | 46 |
| `upstream/agent-presets/code/agent.cordis.yml` | `presets/code/agent.cordis.yml` | 44 | 44 |
| `upstream/agent-presets/minimal/agent.cordis.yml` | `presets/minimal/agent.cordis.yml` | 7 | 7 |

The `preset.yml` metadata files are already Chinese upstream and are shipped
verbatim (same bytes, same hash). The `cordis` preset's two `SKILL.md` files
are skill content, not system prompt; they ship unchanged so the `cordis-zh`
composition's skill rows keep working. Translating them is out of this ticket's
scope (system prompt only).

## What was translated, and what was deliberately not

- **Translated** — every user-visible prose line inside the four
  `agent.cordis.yml` files: the `persona` text, the plan-mode `plan:policy`
  section, the `persistent-bash` tool description in `minimal`, and the
  explanatory comments. Tool and plugin names, API identifiers, `{{model}}` /
  `{{cwd}}` template variables, and `!!js` expressions stay byte-identical.
- **Not translated** — the `harness:identity` line ("You are an AI agent
  powered by DeepSeek Harness.") is host-owned (registered by
  `@deepseek-ai/dsh-system-prompt`, not by any preset), so it is outside the
  four preset files.
- **Not done** — Chinese skill names. The skill-name grammar
  `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` is a module-private constant in
  the host package `@deepseek-ai/dsh-skill`, enforced at registration and load
  time. A plugin cannot change it; supporting Chinese skill names requires a
  host change, which this ticket explicitly forbids.

## Verification

```bash
# 1. Confirm the vendored originals really are the pinned revision
shasum -a 256 upstream/agent-presets/*/agent.cordis.yml \
  | cut -d' ' -f1 | sort > /tmp/actual.txt
printf '%s\n' \
  cb98756a9ed76ca351a45a0ba138a97bf0ab7eead4fe2f1e9d1c9f9ec97937f0 \
  16ad73eabe064f33056924c7157b944a74425ce9b6b5e9b8d910d369d9e15ed8 \
  749da0d93d3824bc4a227b6ead38c99b4247e63108e48bd5fc661b463da00077 \
  cacb47f09a88985c8eb0906a62e6883205727a3c8db901807cb03f936b863cca \
  | sort | diff - /tmp/actual.txt

# 2. Re-fetch the originals from the pinned commit and re-check the hashes
for id in standard cordis code minimal; do
  curl -fsSL "https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/config/agent-presets/$id/agent.cordis.yml" \
    | shasum -a 256
done

# 3. Structural anchor: same lines, same paragraphs, byte-identical structure
npm test -- tests/anchor.test.mjs

# 4. Full package check (same anchors + shipped-asset integrity)
npm run prepare
```

## License

This package is MIT-licensed (see `LICENSE`). The translated files are
derivative of upstream content, also MIT-licensed; the upstream license notice
is retained above.
