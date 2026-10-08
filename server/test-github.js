import { getRepoTree, getFileContent } from "./src/services/github.js";

const tree = await getRepoTree("https://github.com/expressjs/express");

console.log("Branch:", tree.branch);
console.log("Truncated:", tree.truncated);
console.log("Useful files:", tree.files.length);
console.log("First 15 files:");
tree.files.slice(0, 15).forEach((f) => console.log(" ", f.path, `(${f.size} bytes)`));

const content = await getFileContent(tree.owner, tree.repo, "package.json", tree.branch);
console.log("\npackage.json starts with:\n", content.slice(0, 300));