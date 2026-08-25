# 05: 完成查词图片与英美音媒体链路

**What to build:** 为已发布 Course Terms 建立经过审核的 Illustration Assets 和独立 US/UK Pronunciation Assets，并在查词抽屉中可靠展示和播放。任意生词的外部音频通过本站安全代理获取，失败时以明确状态降级到设备语音。

**Blocked by:** 02 / 完成 React Words 中心与语境优先词典; 03 / 建立发布驱动的三类 Vocabulary Catalog.

**Status:** claimed

- [ ] 内容编辑能够为 Course Term 准备或导入 Illustration Asset，并记录替代文本、来源和审核状态。
- [ ] 未审核图片不会在学生查词中出现，缺少图片时显示稳定且有意图的空态。
- [ ] 桌面端 Lookup Summary 将图片放在词语信息右侧，小屏布局保持图片和主要控制可达。
- [ ] 内容编辑能够分别记录 US 和 UK Pronunciation Asset 的来源、口音、存储位置和可用状态。
- [ ] 学生只在对应口音真实可用时看到可播放的 US 或 UK 控件，不会把一个录音标记为两种口音。
- [ ] 播放控件反馈 starting、playing、failed 和 fallback 状态，并阻止快速重复触发造成重叠播放。
- [ ] 任意生词的外部音频由本站服务验证和传递，浏览器不直接绑定第三方音频域名。
- [ ] 音频服务限制允许的供应商目标、媒体类型、响应大小和超时，不能成为开放代理。
- [ ] 准备好的课程音频失败或任意词录音不可用时，可明确降级到设备 speech synthesis。
- [ ] 自动化测试覆盖仅 US、仅 UK、两者都有、两者都无、代理失败和设备语音降级。
- [ ] 浏览器测试不访问真实音频或图片供应商，而使用确定性媒体 fixtures 验证学生行为。
