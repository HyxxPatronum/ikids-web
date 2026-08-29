# 跟读评分接入

Type: feature
Status: required before release

## 背景

录音评分是学习流程必须保留的功能，不是可删除的附加项。React 学习页需要保留录音、逐句提交、评分结果展示和重试交互；评分服务则从前端和 Cloudflare 中独立出来。

## 现有方案记录

- `whisper-lab` 已提供本地评分服务：`POST http://127.0.0.1:8787/score`。
- 请求为 `multipart/form-data`，包含 `audio`（WebM 录音）与 `text`（目标英文句子）。
- 返回字段包括：`recognized`、`words`、`overall` 与逐词状态；无识别结果与服务错误分别展示。
- 录音会保留在浏览器本地学习状态中，完成度在全部句子评分后更新。

## 目标

- 为 React 课程页提供独立的 `PronunciationScoring` module interface，并保留现有请求/返回契约。
- 开发环境默认调用本地 `whisper-lab`；部署环境通过 `NEXT_PUBLIC_SCORING_ENDPOINT` 配置独立评分服务地址。
- 不恢复 `/api/score` Cloudflare 代理；前端不能绑定到任意特定云服务。
- 保持录音、重录、评分中、未识别、逐词反馈和完成度更新的完整交互。

## 待决策

- 独立评分服务的部署位置、成本与隐私策略。
- 是否上传原始录音，以及 Account 同步时是否保存录音本体。
- `whisper-lab` 返回契约的版本化与错误码。

## Comments

- 2026-08-27：旧页面使用本地 `8787/score` 与生产 `/api/score` 双路径；React 迁移阶段曾错误地将其列为待接入。
- 2026-08-27：产品决定录音评分必须保留。React 使用本地服务协议，并通过环境变量接入部署后的独立服务；不恢复 Cloudflare 代理。
