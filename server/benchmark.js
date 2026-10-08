import { readFile, writeFile } from "node:fs/promises";
import { askRepo } from "./src/services/ask.js";

const RUNS = Number(process.env.RUNS || 2);        // how many times to ask each question
const DELAY_MS = Number(process.env.DELAY_MS || 3000); // pause between calls to respect free-tier limits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : "n/a");

const cases = JSON.parse(await readFile("benchmark.json", "utf8"));

const rows = [];
let okRuns = 0, failedRuns = 0;
let pickHits = 0, citeHits = 0;
let validCites = 0, totalCites = 0;
let totalSeconds = 0;

for (const [i, t] of cases.entries()) {
  const expected = new Set(t.expectedFiles);
  const row = { repo: t.repo, question: t.question, runs: 0, picked: 0, cited: 0, failed: 0 };

  for (let r = 0; r < RUNS; r++) {
    try {
      const res = await askRepo(t.repo, t.question);
      row.runs++;
      okRuns++;

      // Did step 1 pick at least one correct file?
      if (res.picked.some((f) => expected.has(f))) { row.picked++; pickHits++; }
      // Did a VERIFIED citation point at a correct file?
      if (res.citations.some((c) => expected.has(c.file))) { row.cited++; citeHits++; }

      validCites += res.citations.length;
      totalCites += res.citations.length + res.rejected.length;
      totalSeconds += Number(res.seconds);
    } catch (err) {
      // An API failure is not a wrong answer, so count it separately
      row.failed++;
      failedRuns++;
      console.log(`   run failed: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  rows.push(row);
  console.log(
    `${i + 1}/${cases.length}  ${t.question}\n` +
    `        picked ${row.picked}/${row.runs}, cited ${row.cited}/${row.runs}` +
    (row.failed ? `, failed ${row.failed}` : "")
  );
}

// A question is "stable" if every successful run gave the same pick result
const stable = rows.filter((r) => r.runs > 0 && (r.picked === 0 || r.picked === r.runs)).length;
const answered = rows.filter((r) => r.runs > 0).length;

const summary = {
  date: new Date().toISOString(),
  model: process.env.GEMINI_MODEL,
  questions: cases.length,
  runsPerQuestion: RUNS,
  successfulRuns: okRuns,
  failedRuns,
  filePickAccuracy: pct(pickHits, okRuns),
  citedFileAccuracy: pct(citeHits, okRuns),
  citationValidity: pct(validCites, totalCites),
  stableQuestions: `${stable}/${answered}`,
  avgSeconds: okRuns ? (totalSeconds / okRuns).toFixed(1) : "n/a",
};

console.log("\n===== SUMMARY =====");
console.table(summary);

await writeFile("benchmark-results.json", JSON.stringify({ summary, rows }, null, 2));
console.log("Saved to benchmark-results.json");