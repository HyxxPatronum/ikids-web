# JSON 数据 Schema 优化

Type: feature
Status: pending

## 背景

`lib/course/*.web-card.json` 是课程卡片的唯一数据源，前端（课程目录、学习页、词汇中心、内容工作台）直接消费其中的字段。审查发现 JSON 中存在与前端实际消费无关的字段、重复字段和并存的别名写法，需要收敛 schema，降低数据体积与维护成本。

## 目标

- 删除前端零引用的冗余字段。
- 将含未来价值的生成过程元数据与运行时数据分离（归档）。
- 统一字段别名，避免多种写法并存。

## 范围

仅涉及 `lib/course/*.web-card.json` 的 schema 与相关读取/写入代码（`lib/course-data.ts`、`app/admin/import/AdminImport.tsx`），不改变前端渲染逻辑。

详见子 ticket：`issues/01-json-schema-review.md`
