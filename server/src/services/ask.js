import { generate } from "./ai.js";
import { getRepoTree, getFileContent } from "./github.js";

const MAX_FILES = 8;
const MAX_LINES_PER_FILE = 300;
const MAX_PATHS_IN_PROMPT = 1500;
const MAX_SNIPPET_LINES = 60;

// Simple in-memory caches (we'll move these to the database later)
const treeCache = new Map();
const fileCache = new Map();

export async function getTreeCached(repoUrl) {
  if (!treeCache.has(repoUrl)) {
    treeCache.set(repoUrl, await getRepoTree(repoUrl));
  }
  return treeCache.get(repoUrl);
}

export async function getFileCached(tree, path) {
  const key = `${tree.owner}/${tree.repo}/${tree.branch}/${path}`;
  if (!fileCache.has(key)) {
    fileCache.set(
      key,
      await getFileContent(tree.owner, tree.repo, path, tree.branch)
    );
  }
  return fileCache.get(key);
}

// ---------- AI call 1: pick the relevant files ----------
export async function pickFiles(question, paths) {
  const list = paths.slice(0, MAX_PATHS_IN_PROMPT);

  const prompt = `
You are helping a developer explore a codebase.
Below is the repository's file list. Pick the ${MAX_FILES} or fewer files
most likely to contain the answer to the question. Only choose from the list.
Prefer core source files over tests, examples, and documentation, unless the
question is specifically about them.

Question: ${question}

Files:
${list.join("\n")}

Respond as JSON: { "files": string[] }
`;

  const response = await generate({
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const result = JSON.parse(response.text);
  const allowed = new Set(list);
  return (result.files || []).filter((f) => allowed.has(f)).slice(0, MAX_FILES);
}

// ---------- AI call 2: answer using the file contents ----------
function numberLines(lines) {
  return lines.map((line, i) => `${i + 1}| ${line}`).join("\n");
}

export async function answerQuestion(question, fetched) {
  const fileBlocks = [...fetched.entries()]
    .map(([path, lines]) => `=== FILE: ${path} ===\n${numberLines(lines)}`)
    .join("\n\n");

  const prompt = `
You are an expert developer explaining a codebase.
Answer the question using ONLY the files below. Each line starts with its line number.
If the files do not contain the answer, say so clearly instead of guessing.
Cite the exact file and line range that supports each claim.

Question: ${question}

${fileBlocks}

Respond as JSON:
{
  "answer": string,
  "citations": [ { "file": string, "startLine": number, "endLine": number, "why": string } ]
}
`;

  const response = await generate({
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  return JSON.parse(response.text);
}


// ---------- Verification: never trust the AI's citations ----------
export function verifyCitations(citations, fetched) {
  const valid = [];
  const rejected = [];

  for (const c of citations || []) {
    const lines = fetched.get(c.file);
    const start = Number(c.startLine);
    const end = Number(c.endLine);

    if (!lines) {
      rejected.push({ ...c, reason: "file was not provided" });
      continue;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      rejected.push({ ...c, reason: "invalid line numbers" });
      continue;
    }
    if (end > lines.length) {
      rejected.push({ ...c, reason: `file only has ${lines.length} lines available` });
      continue;
    }

    const clampedEnd = Math.min(end, start + MAX_SNIPPET_LINES - 1);
    valid.push({
      ...c,
      endLine: clampedEnd,
      snippet: lines.slice(start - 1, clampedEnd).join("\n"), // real code, not AI text
    });
  }

  return { valid, rejected };
}

// Paths that rarely answer "how does X work" questions
const LOW_PRIORITY = [
  /(^|\/)(tests?|__tests__|spec)\//i,
  /(^|\/)(examples?|docs?|benchmarks?|fixtures?)\//i,
  /\.(test|spec)\.[jt]sx?$/i,
  /\.(md|txt)$/i,
];

function filterPaths(question, paths) {
  const q = question.toLowerCase();

  // If the user asks about tests, examples or docs, don't hide them
  const wantsLowPriority =
    /\b(tests?|testing|examples?|docs?|documentation|readme|benchmarks?)\b/.test(q);
  if (wantsLowPriority) return paths;

  const core = paths.filter((p) => !LOW_PRIORITY.some((re) => re.test(p)));

  // Safety net: if filtering leaves almost nothing, fall back to everything
  return core.length >= 5 ? core : paths;
}

// ---------- Full pipeline ----------
export async function askRepo(repoUrl, question) {
  const t0 = Date.now();

  const tree = await getTreeCached(repoUrl);
  const paths = filterPaths(question, tree.files.map((f) => f.path));

  const picked = await pickFiles(question, paths);
  if (picked.length === 0) {
    return { answer: "Could not find relevant files.", citations: [], rejected: [], picked };
  }

  const fetched = new Map();
  await Promise.all(
    picked.map(async (path) => {
      const content = await getFileCached(tree, path);
      const lines = content.split(/\r?\n/).slice(0, MAX_LINES_PER_FILE);
      fetched.set(path, lines);
    })
  );

  const result = await answerQuestion(question, fetched);
  const { valid, rejected } = verifyCitations(result.citations, fetched);

  return {
    answer: result.answer,
    citations: valid,
    rejected,
    picked,
    seconds: ((Date.now() - t0) / 1000).toFixed(1),
  };
}