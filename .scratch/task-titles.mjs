import fs from "node:fs";
const path = "index.html";
let content = fs.readFileSync(path, "utf8");

// Task 4: Comprehension
content = content.replace(
  '<div class="practice-intro"><div><p class="eyebrow">Comprehension</p><h2 class="section-title">阅读理解</h2></div>',
  '<div class="practice-intro"><div><h2 class="section-title task-title"><span class="task-tag">Task 4</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Comprehension</span></h2></div>'
);

// Task 5: Rebuild (table version - the eyebrow pattern with escapeHtml)
content = content.replace(
  /<p class="eyebrow">\$\{escapeHtml\(state\.card\.articleStructure\|\|state\.card\.structure\|\|'Article Structure'\)\}<\/p><h2 class="section-title">重建文章的科学结构<\/h2><p class="muted">每组关系已给出一侧。把上方备选内容拖入对应空格；手机上可先点备选，再点空格。<\/p>/,
  '<h2 class="section-title task-title"><span class="task-tag">Task 5</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Rebuild</span></h2><p class="muted">每组关系已给出一侧。把上方备选内容拖入对应空格；手机上可先点备选，再点空格。</p>'
);

// Task 5: Rebuild (sequence version)
content = content.replace(
  /<p class="eyebrow">\$\{escapeHtml\(state\.card\.articleStructure\|\|state\.card\.structure\|\|'Article Structure'\)\}<\/p><h2 class="section-title">重建文章的科学结构<\/h2><p class="muted">\$\{label\}：拖动右侧句子到左侧图中；在手机或键盘上，也可以先选句子，再选择位置。<p>/,
  '<h2 class="section-title task-title"><span class="task-tag">Task 5</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Rebuild</span></h2><p class="muted">${label}：拖动右侧句子到左侧图中；在手机或键盘上，也可以先选句子，再选择位置。</p>'
);

// Task 6: Result
content = content.replace(
  '<p class="eyebrow" style="color:#ffd6c9">Lesson result</p><h2>本课学习结果</h2>',
  '<h2 class="section-title task-title"><span class="task-tag">Task 6</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Result</span></h2>'
);

fs.writeFileSync(path, content, "utf8");
console.log("Done. Checking for task-tags...");
const matches = content.match(/task-tag/g);
console.log("task-tag occurrences:", matches ? matches.length : 0);
