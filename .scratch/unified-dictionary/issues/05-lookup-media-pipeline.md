# 05: 完成查词图片与英美音媒体链路

**What to build:** 为已发布 Course Terms 建立经过审核的 Illustration Assets 和独立 US/UK Pronunciation Assets，并在查词抽屉中可靠展示和播放。任意生词的外部音频通过本站安全代理获取，失败时以明确状态降级到设备语音。

**Blocked by:** 02 / 完成 React Words 中心与语境优先词典; 03 / 建立发布驱动的三类 Vocabulary Catalog.

**Type:** implementation

**Status:** resolved

- [x] 内容编辑能够为 Course Term 准备或导入 Illustration Asset，并记录替代文本、来源和审核状态。
- [x] 未审核图片不会在学生查词中出现，缺少图片时显示稳定且有意图的空态。
- [x] 桌面端 Lookup Summary 将图片放在词语信息右侧，小屏布局保持图片和主要控制可达。
- [x] 内容编辑能够分别记录 US 和 UK Pronunciation Asset 的来源、口音、存储位置和可用状态。
- [x] 学生只在对应口音真实可用时看到可播放的 US 或 UK 控件，不会把一个录音标记为两种口音。
- [x] 播放控件反馈 starting、playing、failed 和 fallback 状态，并阻止快速重复触发造成重叠播放。
- [x] 任意生词的外部音频由本站服务验证和传递，浏览器不直接绑定第三方音频域名。
- [x] 音频服务限制允许的供应商目标、媒体类型、响应大小和超时，不能成为开放代理。
- [x] 准备好的课程音频失败或任意词录音不可用时，可明确降级到设备 speech synthesis。
- [x] 自动化测试覆盖仅 US、仅 UK、两者都有、两者都无、代理失败和设备语音降级。
- [x] 浏览器测试不访问真实音频或图片供应商，而使用确定性媒体 fixtures 验证学生行为。

## Answer

Course Term 发布索引现在持久化经过规范化的 Illustration Asset 与独立 US/UK Pronunciation Assets。学生响应仅暴露带替代文本、来源和 approved 状态的同源图片，以及来源、存储位置和可用状态完整且不冲突的课程录音。Lookup Summary 在桌面端并排、小屏堆叠展示图示与发音控件，播放状态覆盖 starting、playing、fallback、failed，并阻止快速重复或切换口音产生重叠与悬挂会话。

任意词的供应商录音只通过 `/api/pronunciation` 返回；代理限制 HTTPS allowlist、拒绝重定向、校验音频媒体类型、6.5 秒超时，并在流式读取超过 5 MB 时立即取消。课程录音或代理失败会降级到对应口音的设备 speech synthesis。浏览器验收使用本地静音 WAV 与 1×1 PNG fixture，不访问真实媒体供应商。

## Verification

- `npm test`：54/54 通过。
- `npm run typecheck`：通过。
- `npm run check`：通过。
- `npm run build`：通过。
- `npx playwright test e2e/lookup-media.spec.ts`：9/9 场景逐项通过；Windows 下 vinext 测试子进程在场景结束后未自动退出，因此 runner 最终由人工终止。
- 双轴复核发现的 Standards 2 个硬性问题、1 个判断项，以及 Spec 5 个问题均已修正或以类型化边界收敛；最终复核无剩余发现。
