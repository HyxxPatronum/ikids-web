# 08: 收缩并移除旧查词实现

**What to build:** 在 React Words、Paragraphs、内容发布和生产初始化全部稳定后，完成 expand-contract 的 contract 阶段。所有查词行为统一通过 Next API 和共享 Dictionary Service，删除重复服务逻辑和需要双份维护的旧查词前端，同时保持项目其他学习功能正常。

**Blocked by:** 04 / 完成 Paragraphs 单词、词形与 Approved Phrase 查词; 07 / 建立可移植的生产初始化与健康检查.

**Status:** resolved

- [x] Words、Paragraphs、短语审核、Vocabulary Catalog、媒体和缓存均只使用统一产品 API 契约。
- [x] 迁移一致性测试证明旧入口与新入口对批准 fixtures 的关键学生可见结果一致。
- [x] 本地开发、自动化测试和生产启动均通过统一 Next API 完成，不再要求兼容服务器提供查词能力。
- [x] 重复的分类、外部查询、缓存、音频转换和响应整形逻辑被移除。
- [x] 旧静态查词抽屉、正文分词和 Words 查词实现不再作为可执行产品路径存在。
- [x] 源文件与生成公共资产只有一个编辑事实源，构建产物不再被独立维护或修补。
- [x] 项目中不存在继续引用已移除兼容查词入口的学生页面、管理流程、测试或文档。
- [x] 迁移期间专用的 parity 测试随旧入口一起删除，稳定公共契约测试和浏览器测试继续保留。
- [x] 全部语法检查、服务契约测试、Words/Paragraphs 浏览器测试、生产初始化验证和构建通过。
- [x] 不属于查词范围的课程学习、账号、目录和管理功能仍能通过现有验收。

## Answer

删除了独立兼容 HTTP 服务、静态 Words 查词页、共享静态词典抽屉和正文逐词 tokenizer。React Words 与 Paragraph 继续使用 `/api/dictionary` 和共享 Dictionary Service；静态完整课程活动保留非查词学习闭环，并把句子朗读改为原生按钮以保持键盘可达性。构建准备脚本会清理旧的生成 `words.html`，导航和文档改指 React Words。

迁移一致性由 Issue 01 的统一服务等价验证承接，并在删除旧入口前用稳定 Dictionary Service 契约 fixtures 与 Words/Paragraphs 浏览器 fixtures 复核关键学生可见结果；专用 parity 路径随兼容入口一并移除。

## Verification

- `npm run check`：通过。
- `npm run typecheck`：通过。
- `npm test`：78/78 通过，包含服务契约、媒体、缓存和生产初始化验证。
- `npm run build`：通过。
- `npx playwright test`：20/20 通过；runner 报告完成后本地双服务进程未自动退出，已手动终止残留会话。
- 双轴复核：Standards 指出的静态句子键盘问题已修复；Spec 指出的 `.gitignore` 残留引用已清理。基线中已有的运行数据和数据库文档改动未被本工单修改或回滚。
