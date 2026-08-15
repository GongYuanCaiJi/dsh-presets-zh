# dsh-presets-zh ｜ Chinese system prompts for the dsh factory agent presets

**把 dsh 出廠 agent 預設（`standard` / `cordis` / `code` / `minimal`）的 system prompt 做成中文版，按 locale 載入。** A dsh bundle that ships Chinese translations of the four shipped agent-preset system prompts and loads them by locale.

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) · 移植自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) · 請也給上游一個 star ⭐

## 功能 Features

- **四個中文預設**：`standard-zh` / `cordis-zh` / `code-zh` / `minimal-zh`，對應英文出廠版逐字對譯（段落數相等、結構行逐字保留，見 `THIRD_PARTY_NOTICES.md` 的驗證錨）。
- **按 locale 載入**：插件讀取宿主 locale 設定（`settings.locale.preference`，其自身 fallback 就是 `zh`），把中文預設掛進使用者預設根目錄 `$DSH_HOME/.agent-presets/`，並在中文 locale 下把預設指到 `standard-zh`。切回英文自動還原。
- **不覆寫使用者創作**：中文預設只在使用者沒改過、且套件升級時重寫；編輯過的一律不動（照宿主規則「複製成新預設再改」）。
- **skill 內容原文保留**：`cordis-zh` 隨附的兩個組合創作 skill（`editing-cordis-compositions`、`cordis-plugin-development`）為英文原文——skill 內容不在本票範圍。
- **翻譯即翻譯，不偷加內容**：只動使用者可見的敘事/指令文本；工具名、插同名、`!!js` 表達式等結構行逐字保留。

## 效果 Effects

DeepSeek 是中文母語模型，英文 system prompt 會讓內部推理傾向英文；中文使用者提問 → 先轉英文思考 → 再轉回中文輸出，多一層翻譯損耗。中文版提示詞讓「問」與「想」同語，減低語氣與細節失真（此為 [Discussions #320](https://github.com/deepseek-ai/deepseek-harness/discussions/320) 的原始需求；DeepSeek 官方也建議中文使用者用中文提示詞追求更好效果，見 [DeepSeek 文檔](https://api-docs.deepseek.com/)。）。

## 安裝 Install

尚未發布到 npm，用 GitHub 直裝：

```bash
dsh plugin --profile web add github:GongYuanCaiJi/dsh-presets-zh
```

（`github:` 安裝需要 build script 已納入套件的 `prepare`；如果 pnpm 提示 allowBuilds，就照提示放行。）

裝完開新會話生效。新會話預設落到 `standard-zh`（中文 locale 下）；已開的會話保留原本選擇。想換其它中文預設，在 UI 的 preset 挑選器選 `cordis-zh` / `code-zh` / `minimal-zh`；挑選器顯示名稱沿用上游中文名（id 結尾的 `-zh` 即中文版）。

## 驗證 Verification

```bash
npm test                 # 翻譯錨（行數/段落數/結構行）+ 插件邏輯
npm run prepare          # shipped 資產完整性（vendor 原檔 SHA 對 pinned + 翻譯錨）
```

翻譯出處與逐字 SHA-256、一對一對照表、可複製的驗證指令見 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 已知限制 Known limitations

- **中文 skill 名不支援**：skill 名文法 `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` 是宿主 `@deepseek-ai/dsh-skill` 的模組私有常數，插件層改不了；要支援中文 skill 名得改宿主，本票明確禁止。
- 宿主 `harness:identity` 那一行（"You are an AI agent powered by DeepSeek Harness."）是宿主系統提示詞的一部分，不屬於四個預設檔，未翻譯。

## License

MIT。翻譯檔基於上游 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）內容，上游授權聲明保留於 `THIRD_PARTY_NOTICES.md`。
