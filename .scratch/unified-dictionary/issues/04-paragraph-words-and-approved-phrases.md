# 04: 完成 Paragraphs 单词、词形与 Approved Phrase 查词

**What to build:** 让课程 Paragraphs 使用共享 Lookup Text，使每个英文单词、常见词形和已批准多词 Course Term 都能在当前科学语境中查询。内容编辑能够审核短语候选，学生点击短语时默认看到完整术语，并可切换到其中任意单词。

**Blocked by:** 02 / 完成 React Words 中心与语境优先词典; 03 / 建立发布驱动的三类 Vocabulary Catalog.

**Status:** resolved

- [x] 课程 Paragraphs 中每个英文单词都能通过指针或触摸发起 Lookup。
- [x] 标点、大小写和普通所有格不会阻止精确单词查询。
- [x] 规则词形和已覆盖的常见不规则 Surface Forms 能解析为正确 Lexeme，同时保留原始 Surface Form。
- [x] 成功的精确匹配不会被不必要的词形还原覆盖。
- [x] 导入或已批准的多词 Course Term 使用确定性的最长匹配成为默认 Lookup Scope。
- [x] 点击 Approved Phrase 内任一单词时，抽屉默认展示完整短语，并提供每个组成单词的范围切换。
- [x] 未批准的相邻单词保持独立，运行时不会猜测并发布新短语。
- [x] 内容编辑可以预览、接受、修正或拒绝短语候选；候选在批准并发布前不影响学生文本。
- [x] 查询请求携带当前课程和必要句子上下文，使 Course Sense 排序可复现。
- [x] 契约测试覆盖标点、规则/不规则词形、未知词、重叠短语、最长匹配和组成单词切换。
- [x] 浏览器测试从 Paragraph 打开单词和短语，验证范围切换、课程语境释义和关闭后阅读位置恢复。

## Answer

新增框架无关的 Lookup Text 最长匹配模块、React `LookupText` 与共享 Lookup Provider/Drawer。课程阅读入口现在把每个英文 Surface Form 变成可点按范围；Approved Phrase 默认作为整体打开，并可切换到每个组成词。Dictionary Service 使用精确优先、词形候选回退，支持常见复数、所有格、规则 `-ed`/`-ing` 与既有不规则形式，并携带课程和句子上下文选择 Course Sense。

内容端新增受编辑 token 保护的短语候选预览/接受/修正/拒绝 API。草稿和未发布内容不会进入学生目录；已发布卡片必须先取消发布再审核，随后重新发布才会更新学生文本与索引。课程目录仍直达原有完整课程活动，Course Sense 来源链接进入新的 React Paragraph 阅读入口。

## Verification

- `npm test`：22/22 通过。
- `npm run typecheck`：通过。
- `npm run check`：通过。
- `npm run build`：通过。
- `npx playwright test`：5/5 通过；runner 报告完成后本地双服务进程未自动退出，已手动终止残留会话。
- 双轴复核：Standards 0，Spec 0。
