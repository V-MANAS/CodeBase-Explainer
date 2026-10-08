import "dotenv/config";

const API = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
};

const IGNORED_DIRS = [
  "node_modules", ".git",".github", "dist", "build", "out", "coverage",
  ".next", "vendor", "__pycache__", ".venv", "venv", ".idea", ".vscode",
];
const IGNORED_FILES = [
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", ".DS_Store",
];
const IGNORED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".mp4", ".mp3",
  ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".eot", ".min.js", ".map",
];
const MAX_FILE_BYTES = 100 * 1024;

export function parseRepoUrl(input) {
  const cleaned = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match =
    cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/) ||
    cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

async function githubFetch(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders } });
  if (res.status === 404) throw new Error("Repo or file not found (is it public?)");
  if (res.status === 403 || res.status === 429) {
    throw new Error("GitHub rate limit hit. Check your token or wait a while.");
  }
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  return res;
}

function isUseful(item) {
  if (item.type !== "blob") return false;
  if (item.size > MAX_FILE_BYTES) return false;

  const parts = item.path.split("/");
  const fileName = parts[parts.length - 1].toLowerCase();

  if (parts.some((p) => IGNORED_DIRS.includes(p))) return false;
  if (IGNORED_FILES.includes(fileName)) return false;
  if (IGNORED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) return false;
  return true;
}

export async function getRepoTree(repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  const repoRes = await githubFetch(`${API}/repos/${owner}/${repo}`);
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch;

  const treeRes = await githubFetch(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  const treeData = await treeRes.json();

  const files = treeData.tree
    .filter(isUseful)
    .map((item) => ({ path: item.path, size: item.size }));

  return { owner, repo, branch, truncated: treeData.truncated, files };
}

export async function getFileContent(owner, repo, path, branch) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await githubFetch(
    `${API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`,
    { Accept: "application/vnd.github.raw+json" }
  );
  return res.text();
}