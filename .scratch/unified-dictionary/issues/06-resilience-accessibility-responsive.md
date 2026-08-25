# 06: 完善失败恢复、缓存、无障碍与响应式体验

**What to build:** 让完整 Lookup 在外部服务波动、移动端、小屏横屏、键盘和辅助技术环境下仍然可用。各结果块独立加载和恢复，缓存保护常用内容，模态焦点与长文章导航符合学生实际操作需求。

**Blocked by:** 04 / 完成 Paragraphs 单词、词形与 Approved Phrase 查词; 05 / 完成查词图片与英美音媒体链路.

**Status:** resolved

- [x] Course Sense、本地 Dictionary Sense、外部英英、Pronunciation Asset 和 Illustration Asset 可以独立加载和呈现状态。
- [x] 一个外部来源失败不会清除已经可用的本地或缓存结果。
- [x] confirmed not-found 与 temporary provider failure 使用不同状态和恢复文案。
- [x] 临时失败块提供可操作的重试，并保留当前 Lookup Scope、语言模式和已加载内容。
- [x] 支持 configurable positive、negative 和 stale-success 缓存，初始默认值与规范一致。
- [x] 同一规范化 Lookup 的并发请求被合并，避免供应商高峰重复调用。
- [x] 记录聚合成功率、未找到、供应商失败、延迟、缓存命中、stale 使用和音频 fallback 等运行指标。
- [x] 打开抽屉后背景不可交互，焦点限制在模态内；关闭动画完成后再恢复背景和触发元素焦点。
- [x] 长 Paragraphs 使用高效键盘焦点策略，不把所有单词放入文档级连续 Tab 顺序，同时保持读屏阅读语义。
- [x] 英英/英汉切换具备完整的键盘交互、选中状态和关联内容语义。
- [x] 桌面、平板、手机竖屏和横屏均能访问关闭、范围切换、发音、更多、重试及滚动内容。
- [x] 动态视口、安全区、超长词、长释义、缺失媒体和 reduced-motion 均有浏览器验收覆盖。
- [x] 自动无障碍扫描与显式键盘/焦点断言同时通过；视觉截图只作为有限回归信号而非唯一判断。

## Answer

- Dictionary Service 增加分块可用状态、可配置 positive/negative/stale-success TTL、过期 stale 淘汰、结构化 lookup 指标，并保留同一规范化请求的并发合并。
- Lookup 抽屉按范围和语言保留已加载数据，区分 confirmed not-found 与 temporary provider failure，支持局部重试、背景 inert、焦点陷阱、退出后焦点恢复和完整 tab 键盘语义。
- Paragraph 查词使用每句一个文档级 Tab 入口，并通过方向键、Home、End 在词范围间导航；响应式样式覆盖动态视口、安全区、横竖屏、长内容、缺失媒体和 reduced-motion。
- 验证通过：58 个单元测试、20 个 Playwright 浏览器测试、TypeScript 类型检查、静态脚本检查、生产构建与 axe 自动无障碍扫描。
