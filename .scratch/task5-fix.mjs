import fs from "node:fs";
const path = "index.html";
let content = fs.readFileSync(path, "utf8");
const before = content;
content = content.replace(
  /<p class="eyebrow">\$\{escapeHtml\(state\.card\.articleStructure\|\|state\.card\.structure\|\|'Article Structure'\)\}<\/p><h2 class="section-title">重建文章的科学结构<\/h2>/g,
  '<h2 class="section-title task-title"><span class="task-tag">Task 5</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Rebuild</span></h2>'
);
const count = (before.match(/<p class="eyebrow">\$\{escapeHtml\(state\.card\.articleStructure/g)||[]).length;
fs.writeFileSync(path, content, "utf8");
console.log("remaining old rebuild eyebrow patterns:", count);
const tags = (content.match(/<span class="task-tag">Task 5<\/span>/g)||[]).length;
console.log("Task 5 capsule headers now:", tags);
