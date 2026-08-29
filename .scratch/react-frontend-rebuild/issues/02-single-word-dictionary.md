# 单词查词功能（重构后重新实现）

Type: feature
Status: pending

## 背景

当前查词实现同时包含短语匹配、Course Sense、Vocabulary Catalog、ECDICT、外部词典、缓存、D1、发音代理、媒体资产和多种来源状态，复杂度超过现阶段需求。React 前端重构期间先完整移除查词，避免旧实现继续限制新架构。

## 目标

- 只允许查询一个英文单词，不支持短语匹配。
- 页面选中或点击一个单词后返回稳定、易懂的查词结果。
- 外部释义使用 Free Dictionary API：`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`。
- 正式实现前先用可丢弃 prototype 验证输入、加载、成功、未找到和网络失败状态。
- Dictionary module 对页面只暴露一个小 interface，页面不接触 provider、cache、TTL 或供应商字段。

## 单词规范化

单词规范化是把页面上的表面写法转换成可稳定查询的形式，例如：

- 去掉前后空格；
- 转为小写；
- 把弯引号统一为普通英文撇号；
- 去掉单词前后的句号、逗号、引号等标点；
- 拒绝包含空格、数字或不支持字符的输入。

第一版不做短语匹配，也不承诺复杂词形还原。`Flowers` 是否自动回退到 `flower` 应由 prototype 单独验证后决定。

## 暂不实现

- 多词短语查词；
- D1/ECDICT 聚合；
- 多 provider 聚合和缓存；
- Course Sense 排序；
- 服务端发音代理；
- 查询时生成或搜索图片。

## 数据契约草案

输入：

```ts
type LookupInput = { word: string };
```

输出：

```ts
type LookupResult = {
  word: string;
  phonetic: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string }>;
  }>;
  audioUrl?: string;
};
```

## 完成标准

- 输入中只要包含空格就不会发起查询。
- 同一个单词在课程页和词汇页得到相同结果。
- 未找到与网络失败是两个不同状态。
- 移动端点击目标和抽屉布局可用。
- 不依赖 Cloudflare D1、R2 或 Worker。

## Comments

- 2026-08-27：决定先从现有产品完整移除查词，待 React 前端结构稳定后重新实现。
