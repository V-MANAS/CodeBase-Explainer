import { askRepo } from "./src/services/ask.js";

const repoUrl = "https://github.com/expressjs/express";
const question = process.argv[2] || "How does routing work?";

console.log("Question:", question, "\n");

const result = await askRepo(repoUrl, question);

console.log("Files picked:", result.picked);
console.log("\nANSWER:\n", result.answer);

console.log("\nVERIFIED CITATIONS:", result.citations.length);
for (const c of result.citations) {
  console.log(`\n- ${c.file} (lines ${c.startLine}-${c.endLine})`);
  console.log(`  why: ${c.why}`);
  console.log(c.snippet.split("\n").slice(0, 6).map((l) => "    " + l).join("\n"));
}

console.log("\nREJECTED CITATIONS:", result.rejected.length);
for (const r of result.rejected) {
  console.log(`- ${r.file} (${r.startLine}-${r.endLine}): ${r.reason}`);
}

console.log(`\nTime: ${result.seconds}s`);