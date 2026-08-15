# dsh-presets-zh ｜ Chinese system prompts for the dsh factory agent presets

**把 dsh 出厂 agent 预设（`standard` / `cordis` / `code` / `minimal`）的 system prompt 做成中文版，按 locale 载入。** A dsh bundle that ships Chinese translations of the four shipped agent-preset system prompts and loads them by locale.

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) · 移植自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) · 请也给上游一个 star ⭐

## 功能 Features

- **四个中文预设**：`standard-zh` / `cordis-zh` / `code-zh` / `minimal-zh`，对应英文出厂版逐字对译（段落数相等、结构行逐字保留，见 `THIRD_PARTY_NOTICES.md` 的验证锚）。
- **按 locale 载入**：插件读取宿主 locale 设定（`settings.locale.preference`，其自身 fallback 就是 `zh`），把中文预设挂进使用者预设根目录 `$DSH_HOME/.agent-presets/`，并在中文 locale 下把预设指到 `standard-zh`。切回英文自动还原。
- **不覆写使用者创作**：中文预设只在使用者没改过、且套件升级时重写；编辑过的一律不动（照宿主规则“复制成新预设再改”）。
- **skill 内容原文保留**：`cordis-zh` 随附的两个组合创作 skill（`editing-cordis-compositions`、`cordis-plugin-development`）为英文原文——skill 内容不在本票范围。
- **翻译即翻译，不偷加内容**：只动使用者可见的叙事/指令文本；工具名、插同名、`!!js` 表达式等结构行逐字保留。

## 效果 Effects

DeepSeek 是中文母语模型，英文 system prompt 会让内部推理倾向英文；中文使用者提问 → 先转英文思考 → 再转回中文输出，多一层翻译损耗。中文版提示词让“问”与“想”同语，减低语气与细节失真（此为 [Discussions #320](https://github.com/deepseek-ai/deepseek-harness/discussions/320) 的原始需求；DeepSeek 官方也建议中文使用者用中文提示词追求更好效果，见 [DeepSeek 文档](https://api-docs.deepseek.com/)。）。

## 安装 Install

尚未发布到 npm，用 GitHub 直装：

```bash
dsh plugin --profile web add github:GongYuanCaiJi/dsh-presets-zh
```

（`github:` 安装需要 build script 已纳入套件的 `prepare`；如果 pnpm 提示 allowBuilds，就照提示放行。）

装完开新会话生效。新会话预设落到 `standard-zh`（中文 locale 下）；已开的会话保留原本选择。想换其它中文预设，在 UI 的 preset 挑选器选 `cordis-zh` / `code-zh` / `minimal-zh`；挑选器显示名称沿用上游中文名（id 结尾的 `-zh` 即中文版）。

## 验证 Verification

```bash
npm test                 # 翻译锚（行数/段落数/结构行）+ 插件逻辑
npm run prepare          # shipped 资产完整性（vendor 原档 SHA 对 pinned + 翻译锚）
```

翻译出处与逐字 SHA-256、一对一对照表、可复制的验证指令见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 已知限制 Known limitations

- **中文 skill 名不支援**：skill 名文法 `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` 是宿主 `@deepseek-ai/dsh-skill` 的模组私有常数，插件层改不了；要支援中文 skill 名得改宿主，本票明确禁止。
- 宿主 `harness:identity` 那一行（"You are an AI agent powered by DeepSeek Harness."）是宿主系统提示词的一部分，不属于四个预设档，未翻译。

## License

MIT。翻译档基于上游 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）内容，上游授权声明保留于 `THIRD_PARTY_NOTICES.md`。
