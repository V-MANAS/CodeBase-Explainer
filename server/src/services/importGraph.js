import path from "node:path";
import { getTreeCached, getFileCached } from "./ask.js";

const CODE_EXT = /\.(js|jsx|mjs|cjs|ts|tsx)$/i;
const SKIP = [
  /(^|\/)(tests?|__tests__|spec)\//i,
  /(^|\/)(examples?|docs?|benchmarks?|fixtures?)\//i,
  /\.(test|spec)\.[jt]sx?$/i,
];
const MAX_FILES = 60;
const BATCH_SIZE = 10;
const RESOLVE_EXT = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

// Four ways a JS/TS file can import another file
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g, // import x from './a'  |  import './a'
  /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,       // export { x } from './a'
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,                // require('./a')
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,                 // import('./a')
];

// Returns only relative specifiers like "./a" or "../b/c".
// Package imports like "react" or "express" are not part of this repo, so we skip them.
function extractImports(source) {
  const specs = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith(".")) specs.add(match[1]);
    }
  }
  return [...specs];
}

// Turns "./application" (imported from lib/express.js) into "lib/application.js"
function resolveImport(fromFile, spec, fileSet) {
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), spec)
  );
  const candidates = [
    base,
    ...RESOLVE_EXT.map((e) => base + e),
    ...RESOLVE_EXT.map((e) => `${base}/index${e}`),
  ];
  return candidates.find((c) => fileSet.has(c)) || null;
}

// File names come from the repo, so strip characters that would break Mermaid syntax
const label = (text) => text.replace(/"/g, "'");

function toMermaid(files, edges) {
  const ids = new Map(files.map((p, i) => [p, `n${i}`]));

  // Group files by their top-level folder
  const groups = new Map();
  for (const p of files) {
    const folder = p.includes("/") ? p.split("/")[0] : "(root)";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(p);
  }

  const lines = ["graph LR"];
  let g = 0;
  for (const [folder, paths] of groups) {
   lines.push(`  subgraph g${g++}["${label(folder)}"]`);
    for (const p of paths) lines.push(`    ${ids.get(p)}["${label(p)}"]`);
    lines.push("  end");
  }
  for (const [from, to] of edges) {
    lines.push(`  ${ids.get(from)} --> ${ids.get(to)}`);
  }
  return lines.join("\n");
}

export async function buildGraph(repoUrl) {
  const tree = await getTreeCached(repoUrl);

  // Code files only, shallowest first, so the capped set is the "core" of the project
  const all = tree.files
    .map((f) => f.path)
    .filter((p) => CODE_EXT.test(p) && !SKIP.some((re) => re.test(p)))
    .sort((a, b) => a.split("/").length - b.split("/").length);

  const files = all.slice(0, MAX_FILES);
  const fileSet = new Set(files);

  // Fetch in small batches so we don't fire 60 requests at once
  const sources = new Map();
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    await Promise.all(
      files.slice(i, i + BATCH_SIZE).map(async (p) => {
        sources.set(p, await getFileCached(tree, p));
      })
    );
  }

  // Build edges, skipping duplicates and self-imports
  const edgeKeys = new Set();
  const edges = [];
  for (const [file, source] of sources) {
    for (const spec of extractImports(source)) {
      const target = resolveImport(file, spec, fileSet);
      if (!target || target === file) continue;
      const key = `${file}->${target}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([file, target]);
    }
  }

  return {
    files: files.length,
    totalCodeFiles: all.length,
    capped: all.length > MAX_FILES,
    edges: edges.length,
    mermaid: toMermaid(files, edges),
  };
}