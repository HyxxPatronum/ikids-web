import fs from "node:fs";
const c = fs.readFileSync("index.html", "utf8");
const old = c.match(/<p class="eyebrow">\$\{escapeHtml\(state\.card\.articleStructure/g) || [];
const headers = [...c.matchAll(/<span class="task-tag">Task (\d+)<\/span><span class="task-divider"[^>]*><\/span><span class="task-name">([^<]+)<\/span>/g)].map(m => m[1] + ":" + m[2]);
console.log("old rebuild eyebrow:", old.length);
console.log("capsule headers:", headers.join(", "));
