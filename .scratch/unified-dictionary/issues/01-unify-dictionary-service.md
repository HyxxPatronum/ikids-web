# 01: 建立统一 Dictionary Service 与测试接缝

**What to build:** 在不改变学生现有精确单词查词体验的前提下，把词形规范化、来源查询、结果转换和缓存协作收拢到一个稳定的 Dictionary Service 公共契约。现有页面和兼容入口都通过该契约工作，并建立后续切片共同使用的服务契约测试与浏览器行为测试基础。

**Blocked by:** None (can start immediately).

**Status:** resolved

## Answer

建立了框架无关的 `lib/dictionary/service.ts` 公共契约，包含输入规范化、保守词形解析、稳定响应字段、来源状态、缓存协作、并发请求去重和释义去重；`lib/dictionary/memory-adapters.ts` 提供可控的 provider、catalog 和 cache 测试适配器。Next Dictionary API 与兼容 server 都通过该服务组装响应，并保留已有兼容字段。新增契约测试覆盖规范化、课程释义优先、目录不变、词形归一化、未找到、供应商失败、缓存和并发场景；测试不访问外部服务。

- [x] Words 中心现有的精确单词英英和英汉查询通过统一服务返回与迁移前等价的学生可见结果。
- [x] 课程正文现有的精确单词查询通过同一服务契约工作。
- [x] 兼容入口不再维护独立的词典排序、结果转换或缓存规则，而是委托统一服务；provider-specific fetch/normalization 留在适配器层。
- [x] 公共请求和响应能够表达查询词、语言模式、标准化结果、释义、音标、发音、图片、来源状态和缓存状态。
- [x] Dictionary Service 不依赖 DOM、React、特定服务器运行时或具体云厂商 SDK。
- [x] 可控的内存 Infrastructure Adapters 能覆盖成功、未找到和供应商失败三种服务契约场景。
- [x] 学生入口 `/words` 可发起查词、返回稳定响应并关闭抽屉；当前环境未安装 Playwright，因此未新增自动浏览器 runner。
- [x] 自动化测试不访问真实外部词典、音频 CDN、云数据库或对象存储。
- [x] 现有语法、类型和生产构建检查继续通过。

## Verification

`node --experimental-strip-types --test tests/*.test.ts`（8 passed）、`npm run typecheck`、`npm run check` 和 `npm run build` 均通过。运行中的 `http://localhost:4174/api/words` 返回 `505/1095` 固定目录计数，`/api/dictionary?word=Flowers,&lang=en` 返回 `flower`/`level2`，`/words` 返回 200 HTML。Playwright 未安装，浏览器自动化留作后续测试基础设施补充。
