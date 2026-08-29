# ISSUE.md — 待解决事项清单

本文件用于记录**尚未解决 / 待确认 / 待实现**的事项。新增条目时按底部模板追加，保持每条独立、可追溯。

---

## 1. 课程音频生成的模板化（批量生成）

- **状态**：待确认（已分析，未实现）
- **日期**：2026-08-27
- **标签**：音频 / 批量生成 / 内容管线

### 背景

第一课（seed）已完成端到端接入：用 edge-tts（Ava Multilingual 女声）生成 `web/public/audio/science-reading-1-seed/`（每句一个 mp3 + full.mp3 + manifest.json），页面 `index.html` 已支持"有音频播音频、无音频回退浏览器语音"，并完成精确进度、任意位置暂停/续播、拖动跳转、语速、点句试听、跟读示范等适配。

### 已模板化的部分（新课程零改动）

- **页面侧**：`index.html` 自动探测 `/audio/<课程slug>/manifest.json`，有则播音频，无则回退 TTS。任何新课放好音频即自动生效。
- **生成侧**：`tts-lab/scripts/generate.py` 已参数化（--input / --outdir / --voice / --rate / --pitch），默认声音已固定为 Ava Multilingual。

### 待办

写一个**批量生成脚本**，自动完成"读课程 → 抽句子 → 生成音频 → 放对目录 → 写 manifest"，使"加一门新课 = 导入内容 + 跑一条命令"。

脚本设计要求：

1. 数据源：课程卡片库（slug、内容文件、正文句子）
2. 抽句子：与页面完全一致的规则（paragraphs → sentences），保证一一对应
3. 批量：逐课生成到 `web/public/audio/<slug>/` + `manifest.json`，统一默认声音/语速/音高
4. 增量：已有音频自动跳过，`--force` 强制重新生成
5. 可选：挂到构建脚本（`prepare-public.mjs`）自动补齐缺失音频

### 待确认（阻塞点）

批量脚本的**课程数据源**：

- **方案 A**：以网站卡片库为准（`web/data/app-db.json` + `web/public/*.json`）——与页面一致，但 seed 课目前不在卡片库中（它在 `output/` 目录），需先登记 seed 课
- **方案 B**：以 `output/` 目录为准——需兼容 output 内容格式与网站内容格式两种结构

### 下一步

确认数据源方案后，实现批量生成脚本，并补充使用文档。

---

## 2. 课程内容防复制——水印与登录鉴权（第二、三档）

- **状态**：待实现（依赖登录体系）
- **日期**：2026-08-27
- **标签**：防复制 / 登录鉴权 / 水印

### 背景

网站将公开上线，不希望别人把辛苦做的左侧卡片（课程配图）和课程内容复制走。已实现**第一档**基本门槛（课程区域禁止右键菜单、禁止选中文字、图片禁止拖拽）。

注意：网页内容无法 100% 防复制（可截图、看源码、直接请求图片地址），防护思路是"提高门槛 + 可溯源"。

### 待办

- **第二档 · 水印**：在卡片图上叠加半透明水印（当前登录用户ID/昵称），截图/盗用后可溯源；需登录体系提供用户标识。
- **第三档 · 登录鉴权**：图片与课程内容改为走接口 + 必须登录才能加载（未登录返回 403），不再暴露静态文件直链；上线部署时实现。

### 备注

- 建议与登录体系一起做；上线时第三档为必做项。
- 相关文件：`web/public/index.html`（第一档已加禁右键/禁选中/禁拖拽）。

---

## 3. 数据接口与数据完善清单（确认 / 补齐）

- **状态**：进行中（逐项确认，随进展更新）
- **日期**：2026-08-27
- **标签**：数据 / 接口 / 内容管线

### 背景

多个功能已在前端就绪，但依赖的数据/接口尚未完整，需要逐项确认和补齐。本条作为**汇总清单**，完成一项更新一项。

### 待确认 / 待补齐

1. **句子翻译数据**——页面已实现逐句翻译（点“翻译”显示该句中文）和全文翻译（卡片底部整段中文），但课程数据缺 `translation` 字段，显示“暂无中文翻译”；需为每课补充 `paragraphs[].sentences[].translation`，并在内容管线生成时带上（UI 已就绪，只差数据）
2. **词典接口数据**：/api/dictionary?word= 在开发环境返回空释义/音标（ECDICT 数据未接入服务），需确认词典接口的数据源与接入方式，让查词显示真实释义
3. **词库兜底**：word_bank 已含中文释义，已作为查词兜底；确认是否够用、是否需要补充更多词
4. **课程卡片库登记**：seed 课不在 web/data/app-db.json 中（在 output/ 目录），需确认导入/登记流程（关联 issue #1 数据源问题）
5. **音频数据**：每课需生成 /audio/<slug>/manifest.json（关联 issue #1）
6. **录音评分阈值**：Whisper 评分需真实录音样本校准（whisper-lab）

### 备注

- 本条目持续更新：完成一项即勾选/标记，并补充新发现的待完善数据。
- 相关：web/data/app-db.json、output/、whisper-lab。

---

## 4. 词卡 / 消消乐需补充词卡图片（word_bank 缺 image 字段）

- **状态**：待实现
- **日期**：2026-08-28
- **标签**：数据 / 词卡图片 / 内容管线

### 背景

词义配对的词卡（word-card）与消消乐的图片卡（word-tile.image）支持为每个核心词显示真实图片（`word.image` 字段）；但当前课程数据（如 `day001-flower.json`）的 `word_bank` 条目均缺 `image` 字段，页面只能回退到内置 SVG 插图（bud/roots/soil/sunlight/petals/unfold 等兜底图），视觉上不直观。

### 待办

1. 为每课 `word_bank` 的每个核心词补充 `image` 字段（如 `"image":"word-bud.png"`）
2. 将对应词卡图片放入 `web/public/`（命名与 `image` 一致，页面自动以 `/<image>` 加载）
3. 内容管线生成课程 JSON 时自动带上词卡图片，避免手工补充
4. 已有课程（至少 `day001-flower`）按同样规则回填

### 备注

- 前端已就绪：`wordTileImageSource()` / `wordTileIllustration()` 优先读 `word.image_file || word.image`，有图即显示真实图片，无图才回退 SVG。只差数据。
- 相关文件：`web/public/day001-flower.json`、`web/public/index.html`（词卡/消消乐渲染）。

---


---

## 5. JSON 数据 Schema 优化——冗余字段清理、元数据归档、别名统一

- **状态**：待确认（审查完成，待用户决策后执行）
- **日期**：2026-08-28
- **标签**：数据 / schema / 内容管线

### 背景

`lib/course/*.web-card.json` 是课程卡片的唯一数据源，前端（课程目录、学习页、词汇中心、内容工作台）直接消费其中的字段。逐一扫描 10 个 JSON 文件的全部字段，对照前端代码（`app/`、`lib/`）确认实际消费情况，发现三类问题：**前端零引用的冗余字段、重复字段、别名并存**。

### 审查结论

#### A. 建议删除（零引用 + 无保留价值，零风险）

| 字段 | 位置 | 现状 |
|---|---|---|
| `structure` | 顶层 | 与 `articleStructure` 完全重复（10/10 文件值相同），前端仅作 fallback |
| `listenRead.fullAudio` | 听读 | 恒为 `null`，零引用；音频由独立字段 `audioDirectory` 驱动 |
| `listenRead.coreSentenceAudio` | 听读 | 恒为 `null`，零引用 |

#### B. 零引用但可能有未来价值（建议归档，需决策）

这些字段是内容生成过程的工作底稿（AI 生成时的推理与审核记录），前端全部不消费：

| 字段 | 内容 | 潜在价值 |
|---|---|---|
| `callouts` | 文章要点提取（6-7 条/文件） | 无明确用途 |
| `reasoning_chain` | 科学推理链（input→mechanism→result） | 未来“推理可视化” |
| `difficulty_metrics` | 字数、句长、熟悉度百分比、认知检查 | 未来难度分级/复习排序 |
| `vocabulary_audit` | 词汇分级 tier_505/tier_1095 + necessity_notes 词典 | 未来词汇复习、选词审核 |
| `word_bank[].word_bank_rationale` | 收录理由 | 审核用 |
| `word_bank[].image_semantics` | 配图语义描述 | AI 生成配图时的提示词 |
| `word_bank[].paragraph_form` | 词在段落中的实际形式（push→pushes） | 段落内核心词高亮 |

归档方案：移至独立文件（如 `lib/course-meta/*.json`），运行时 JSON 不再包含。

#### C. 需规范统一的字段别名

| 现状 | 问题 | 建议 |
|---|---|---|
| `translations` vs `paragraphTranslations` | 两种写法并存，学习页做 fallback；当前 10 个 JSON 均缺失，中文翻译走前端硬编码 fallback | 统一为一个字段 |
| `word_bank[].image_file / image / illustration` | 三种字段名（当前均无数据） | 统一为 `image_file` |
| `contextQuestions[].image_file / image` | 两种字段名（当前均无数据） | 统一为 `image_file` |
| `version` | 前端不读 | 保留作 schema 版本标识，校验时检查 |

#### D. 确认保留（被前端实际消费）

- 顶层：`cardId, courseId, seriesId, topic, theme, day, level, title, bigQuestion, image_file, articleStructure, status, paragraphs, audioDirectory`
- `word_bank[].english / chinese`
- `comprehension.questions[]`（type/prompt/options/answer）
- `wordModule.matchPairs[]`（word/meaning）、`wordModule.contextQuestions[]`（prompt/options/answer）
- `rebuild.type / steps`
- `listenRead.sentences[]`（sentence/role）

### 待决策 / 待实现

1. **B 组**（`callouts` / `reasoning_chain` / `difficulty_metrics` / `vocabulary_audit` / `word_bank_rationale` / `image_semantics` / `paragraph_form`）——删除还是归档到独立文件？
2. **C 组统一后**：`translations` 缺失的中文翻译是否补录到 JSON，还是保持前端 fallback？
3. 确认判决后：
   - 从全部 10 个 `*.web-card.json` 中移除 A 组字段
   - 若选归档，将 B 组移至 `lib/course-meta/*.json`
   - 统一 C 组字段名（先不复写到现有 JSON，仅收拢 admin 表单和 API 写入规范）

### 备注

- 完整审查过程见 `.scratch/json-schema-optimization/issues/01-json-schema-review.md`
- 相关：`lib/course/*.web-card.json`、`app/admin/import/AdminImport.tsx`（admin 上传表单）
- 实施时需同步更新 `lib/course-data.ts` 的类型定义


## 追加模板（复制到文件末尾填写）

```
## <N+1>. <标题>

- **状态**：待确认 / 待实现 / 进行中 / 已完成
- **日期**：YYYY-MM-DD
- **标签**：<分类>

### 背景
<简述问题/需求>

### 待办 / 待确认
<列出具体事项或需要决策的问题>

### 备注
<可选：相关文件、链接、上下文>
```
