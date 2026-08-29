# JSON Schema 审查：删除冗余字段、归档元数据、统一别名

Type: task
Status: pending

## 背景

审查了 `lib/course/` 下全部 10 个 `*.web-card.json`，逐字段扫描前端代码（`app/`、`lib/`）的实际消费点，并对照 PRD §9.2 必填字段。发现三类问题：前端零引用字段、重复字段、别名并存。

## 审查结论

### A. 建议删除（前端零引用 + 无保留价值，零风险）

| 字段 | 位置 | 现状 |
|---|---|---|
| `structure` | 顶层 | 与 `articleStructure` 完全重复（10/10 文件值相同），前端仅作 fallback |
| `listenRead.fullAudio` | 听读 | 恒为 `null`，零引用；音频由独立字段 `audioDirectory` 驱动 |
| `listenRead.coreSentenceAudio` | 听读 | 恒为 `null`，零引用 |

### B. 零引用但可能有未来价值（建议归档，需决策）

这些字段是内容生成过程的工作底稿（AI 生成时的推理与审核记录），前端全部不消费：

| 字段 | 内容 | 潜在价值 |
|---|---|---|
| `callouts` | 文章要点提取（6-7 条/文件） | 无明确用途 |
| `reasoning_chain` | 科学推理链（input→mechanism→result） | 未来"推理可视化" |
| `difficulty_metrics` | 字数、句长、熟悉度百分比、认知检查 | 未来难度分级/复习排序 |
| `vocabulary_audit` | 词汇分级 tier_505/tier_1095 + necessity_notes 词典 | 未来词汇复习、选词审核 |
| `word_bank[].word_bank_rationale` | 收录理由 | 审核用 |
| `word_bank[].image_semantics` | 配图语义描述 | AI 生成配图时的提示词 |
| `word_bank[].paragraph_form` | 词在段落中的实际形式（push→pushes） | 段落内核心词高亮 |

建议归档方式：移至独立文件（如 `lib/course-meta/*.json`），运行时 JSON 不再包含。

### C. 需规范统一的字段别名

| 现状 | 问题 | 建议 |
|---|---|---|
| `translations` vs `paragraphTranslations` | 两种写法并存，学习页做 fallback；当前 10 个 JSON 均缺失，中文翻译走前端硬编码 fallback | 统一为一个字段 |
| `word_bank[].image_file / image / illustration` | 三种字段名（当前均无数据） | 统一为 `image_file` |
| `contextQuestions[].image_file / image` | 两种字段名（当前均无数据） | 统一为 `image_file` |
| `version` | 前端不读 | 保留作 schema 版本标识，校验时检查 |

### D. 确认保留（被前端实际消费）

- 顶层：`cardId, courseId, seriesId, topic, theme, day, level, title, bigQuestion, image_file, articleStructure, status, paragraphs, audioDirectory`
- `word_bank[].english / chinese`
- `comprehension.questions[]`（type/prompt/options/answer）
- `wordModule.matchPairs[]`（word/meaning）、`wordModule.contextQuestions[]`（prompt/options/answer）
- `rebuild.type / steps`
- `listenRead.sentences[]`（sentence/role）

## 待用户决策

1. B 组（7 个元数据字段）：删除还是归档到独立文件？
2. C 组统一后：`translations` 缺失的中文翻译是否补录到 JSON，还是保持前端 fallback？

## Comments

- 2025-xx-xx：审查完成，列出 A/B/C/D 四组结论待确认。
