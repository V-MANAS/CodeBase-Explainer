import "dotenv/config";
import express from "express";
import cors from "cors";
import { getTreeCached, askRepo } from "./services/ask.js";
import { buildGraph } from "./services/importGraph.js";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
// WHAT: allow only our frontend to call this API.
// WHY: without this, the browser blocks the React app's requests.
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

const allowedOrigins = [
  CLIENT_ORIGIN,
  "https://code-base-explainer-livid.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
  })
);// WHAT: parse JSON request bodies into req.body.
// WHY: the frontend sends { repoUrl, question } as JSON; without this, req.body is undefined.
app.use(express.json());

// WHAT: a trivial endpoint that just says "I'm alive".
// WHY: handy for testing the server, and hosting platforms use it to check health.
app.get("/health", (req, res) => res.json({ ok: true }));

// WHAT: load a repo's filtered file tree.
// WHY: the frontend shows the file tree as soon as the user pastes a URL,
//      before any question is asked.
app.post("/api/repo", async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });
    const tree = await getTreeCached(repoUrl);
    res.json(tree);
  } catch (err) {
    // 400 because the usual cause is the user's input (bad URL, private repo).
    res.status(400).json({ error: err.message });
  }
});
const perUserLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many questions. Please wait a minute and try again.",
  },
});

const dailyCap = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.DAILY_QUESTION_CAP || 200),
  keyGenerator: () => "global",
  standardHeaders: false,
  legacyHeaders: false,
  message: {
    error:
      "The daily question limit has been reached. Please try again tomorrow.",
  },
});

app.use("/api/ask", perUserLimit, dailyCap);
// WHAT: run the full pipeline for one question.
// WHY: this is the main feature of the app.
app.post("/api/ask", async (req, res) => {
  try {
    const { repoUrl, question } = req.body;
    if (!repoUrl || !question) {
      return res.status(400).json({ error: "repoUrl and question are required" });
    }
    if (question.length > 500) {
  return res.status(400).json({
    error: "Please keep your question under 500 characters.",
  });
}
    const result = await askRepo(repoUrl, question);
    res.json(result);
  } catch (err) {
    // Log the real error for you, but send the user a safe, friendly message.
    // WHY: raw errors can leak internal details like file paths or API responses.
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again in a moment." });
  }
});

// WHAT: build the dependency graph (which file imports which).
// WHY: powers the architecture diagram, and needs no AI.
app.post("/api/graph", async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });
    res.json(await buildGraph(repoUrl));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));