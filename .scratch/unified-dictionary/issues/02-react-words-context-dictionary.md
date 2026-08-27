# 02: 完成 React Words 中心与语境优先词典

**What to build:** 让学生在 React Words 中心使用可复用的 Lookup Provider 和 Dictionary Drawer 查询词汇。抽屉优先呈现课程语境和常用信息，支持英英/英汉切换、简明 Lookup Summary 与按需展开的 Lookup Detail，并保存设备语言偏好。

**Blocked by:** 01 / 建立统一 Dictionary Service 与测试接缝.

**Status:** resolved

## Answer

新增 `/words` React Words 中心与可复用 `LookupProvider`/`DictionaryDrawer` 交互层。词汇卡片、分类标签、搜索、分页加载和右侧抽屉均在 React 中完成；抽屉支持英英/英汉切换、设备语言偏好、课程释义优先、摘要/更多详情、发音状态、空图示、遮罩、Escape、关闭按钮和焦点恢复。页面只通过产品 API 获取词库和查询结果；共享 catalog 模块保证固定目录与 published-only Science Core 规则一致。

- [x] 学生可以在 React Words 中心浏览当前词汇卡片并打开右侧查词抽屉。
- [x] Words 中心不再依赖跳转到旧静态词汇页面才能完成核心浏览和查词任务。
- [x] Lookup Summary 显示 Lookup Scope、音标、可用发音状态、最有价值的常用词性和释义，以及图片或明确空态。
- [x] 当前 Course Sense 存在时排在无关 Dictionary Senses 之前。
- [x] 多来源结果保留来源身份、去除完全重复内容，但不会改变 Vocabulary Catalog membership。
- [x] Lookup Detail 通过“更多”显示低频释义、额外例句、词形和来源信息，默认不增加首屏认知负担。
- [x] 英英和英汉模式复用同一个 Lexeme、Course Sense、发音和图片上下文。
- [x] 语言模式切换立即刷新内容，并在当前设备上记住选择。
- [x] 抽屉提供遮罩、小叉号、Escape 关闭和触发元素焦点恢复的基本行为。
- [x] 组件与 API 已覆盖上述行为；当前环境未安装 Playwright，因此未新增自动浏览器 runner。

## Verification

`/words` 运行时返回 200 HTML；React 页面和 API 的 8 个服务/catalog 测试、typecheck、静态检查和 production build 均通过。外部词典不可用时，`Flowers,` 仍显示归一化 `flower`、Level 2 membership 与可用缓存/课程状态。浏览器自动化未执行，原因是项目没有 Playwright 依赖且当前工具环境未提供浏览器控制器。
