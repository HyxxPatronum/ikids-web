# 03: 建立发布驱动的三类 Vocabulary Catalog

**What to build:** 让学生在 Words 中心看到可靠且互斥的 Level 2、Level 3 和 Science Core。Science Core 由已发布课程驱动并通过持久化索引查询；内容编辑可以预览草稿词，但草稿、未发布和归档内容不会泄漏给学生。

**Blocked by:** 02 / 完成 React Words 中心与语境优先词典.

**Status:** resolved

- [x] Level 2 保持 505 条，Level 3 保持 1095 条，两个固定目录没有直接重叠。
- [x] 一个 Lexeme 最多拥有一个 Level 2、Level 3 或 Science Core 的学生目录 membership。
- [x] 已属于 Level 2 或 Level 3 的词可以获得 Course Sense，但不会被重复加入 Science Core。
- [x] 只有 published 课程中的已批准 Course Terms 出现在学生 Science Core。
- [x] draft、unpublished 和 archived 课程词不出现在学生目录，但内容编辑可以预览其词义和分类结果。
- [x] 发布、重新发布、取消发布和归档会幂等地更新学生可见索引和来源课程关系。
- [x] Science Core 条目能够返回其已发布来源课程，供学生回到原文。
- [x] 学生目录和单词查询使用发布索引，不在每次请求中读取并解析全部课程内容。
- [x] 自动化测试使用真实固定目录验证数量、零重叠、别名处理和 Science Core 排除规则。
- [x] 浏览器测试验证三个目录独立浏览、空态、搜索和 published/draft 可见性边界。

## Answer

新增持久化 `published_vocabulary_terms` 发布索引与 D1 适配器。课程发布和重发原子替换该课程词条，取消发布和归档移除对应来源；固定目录 membership 在 Lexeme 还原后判定，只有明确批准的 published Course Terms 会进入学生索引。`/api/words` 与 `/api/dictionary` 改为查询索引，编辑预览使用受服务端 token 保护的独立接口。Words 的 Science Core 来源可链接回原课程。

Playwright 1.62.1 与 Chromium 151 已安装。浏览器验收分别使用 production React UI 与本地 Cloudflare D1 API，覆盖三个目录、Level 2 条目、空态、搜索、草稿不可见、发布后可见、未批准词排除、归档后移除及课程来源链接。

## Verification

- `npm test`：12/12 通过。
- `npm run typecheck`：通过。
- `npm run check`：通过。
- `npm run build`：通过。
- `npx playwright test`：3/3 Chromium 测试通过。
- 双轴复核：Standards 0，Spec 0。
