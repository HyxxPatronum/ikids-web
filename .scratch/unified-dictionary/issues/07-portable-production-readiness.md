# 07: 建立可移植的生产初始化与健康检查

**What to build:** 让统一查词可以稳定部署到面向中国大陆用户的生产环境，同时不把 Dictionary Service 绑定到单一云厂商。数据库、ECDICT、Vocabulary Catalog 索引、缓存和媒体存储通过可重复流程准备，并由健康检查验证真实可用性。

**Blocked by:** 03 / 建立发布驱动的三类 Vocabulary Catalog; 06 / 完善失败恢复、缓存、无障碍与响应式体验.

**Status:** resolved

- [x] 关系数据库、缓存、对象存储、外部英英词典和发音供应商均通过 Infrastructure Adapter 接入。
- [x] Dictionary Service 和 Lookup Presentation 不依赖特定大陆云厂商 SDK 或资源名称。
- [x] 数据库迁移可安全重复执行，普通应用请求不负责建表或批量 seed。
- [x] ECDICT 导入可安全重复执行，并验证预期数据存在，而不只验证表结构存在。
- [x] published Course Terms 和 Vocabulary Catalog 索引可幂等重建，失败时不会留下学生可见的半发布状态。
- [x] Illustration Assets 和 Pronunciation Assets 可以通过对象存储适配器上传、读取和验证。
- [x] 正式健康检查区分应用存活、数据库可用、ECDICT 已初始化、Catalog 索引可用和媒体存储可用。
- [x] 本地开发使用与生产相同的业务契约和初始化入口，但允许使用本地 Infrastructure Adapters。
- [x] 生产配置缺失或初始化不完整时启动/健康验证明确失败，不以空词典伪装成功部署。
- [x] 可观测性输出能够接入后续选择的监控平台，并避免记录不必要的学生自由文本上下文。
- [x] 自动化验证覆盖全新环境初始化、重复执行、部分失败恢复和健康检查降级状态。

## Answer

- 新增可移植 Infrastructure Adapter 契约与 D1/R2 实现；外部英英词典、ECDICT、缓存和媒体读写不再嵌入 Dictionary Service。
- `initialize:local` 与 `initialize:production` 共用迁移、60k ECDICT upsert、内容 seed 和 Catalog staging 快照切换流程；普通 API 请求不再建表或 seed。
- `/api/live` 只报告应用存活；`/api/health` 独立验证数据库、ECDICT 内容、Catalog 标记/计数和对象存储读写，缺配置或未初始化返回 503。
- 媒体 API 经对象存储适配器上传和读取 Illustration/Pronunciation Asset；结构化观测只保留运维字段，不记录学生句子上下文。

## Verification

- `npm run typecheck`：通过。
- `npm test`：78/78 通过（包含真实 Wrangler D1/R2 全新初始化、重复执行、媒体复用和失败恢复）。
- `npm run check`：通过。
- `npm run build`：通过。
- 隔离 D1/R2 环境连续执行两次 `initialize:local`：通过；每次均报告 60000 条 ECDICT、12 条 published Catalog term、1 个已验证媒体资源。
- `npx playwright test`：20/20 用例通过；Windows runner 在 webServer 清理阶段未自动退出，测试进程随后手动终止。
