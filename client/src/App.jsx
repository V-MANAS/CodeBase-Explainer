import { useMemo, useState } from "react";
import { loadRepo, askQuestion, loadGraph } from "./api";
import FileTree from "./FileTree";
import Citation from "./Citation";
import DiagramView from "./DiagramView";
import "./App.css";
import InlineText from "./InlineText";

const EXAMPLE_REPOS = ["expressjs/express", "koajs/koa"];
const STARTERS = [
  "What does this project do?",
  "Where does the app start?",
  "How are errors handled?",
];

// A fixed example so first-time visitors see what an answer looks like
const SAMPLE = {
  file: "lib/express.js",
  startLine: 36,
  endLine: 39,
  why: "Defines createApplication(), which creates the app function.",
  snippet: [
    "function createApplication() {",
    "  var app = function(req, res, next) {",
    "    app.handle(req, res, next);",
    "  };",
  ].join("\n"),
};

function RepoForm({ id, value, onChange, onSubmit, loading, secondary }) {
  return (
    <form className="repo-form" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={id}>GitHub repository</label>
      <input
        id={id}
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="github.com/owner/repo"
        autoComplete="off"
        spellCheck="false"
      />
      <button className={secondary ? "btn secondary" : "btn"} disabled={!value.trim() || loading}>
        {loading ? "Opening..." : "Open repo"}
      </button>
    </form>
  );
}

export default function App() {
  const [repoInput, setRepoInput] = useState("");
  const [repoUrl, setRepoUrl] = useState(""); // the repo we actually opened
  const [repo, setRepo] = useState(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [result, setResult] = useState(null);
  const [graph, setGraph] = useState(null);
  const [tab, setTab] = useState("ask");
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [asking, setAsking] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState("");

  const picked = useMemo(() => new Set(result?.picked ?? []), [result]);

  async function openRepo(url) {
    const target = url.trim();
    if (!target) return;
    setError("");
    setLoadingRepo(true);
    try {
      const data = await loadRepo(target);
      setRepoUrl(target);
      setRepo(data);
      setResult(null);
      setGraph(null);
      setAsked("");
      setTab("ask");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRepo(false);
    }
  }

  async function runAsk(text) {
    const q = text.trim();
    if (!q || asking) return;
    setQuestion(q);
    setAsked(q);
    setError("");
    setResult(null);
    setAsking(true);
    try {
      setResult(await askQuestion(repoUrl, q));
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  async function selectTab(next) {
    setTab(next);
    if (next === "diagram" && !graph && !loadingGraph) {
      setError("");
      setLoadingGraph(true);
      try {
        setGraph(await loadGraph(repoUrl));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingGraph(false);
      }
    }
  }

  const errorBox = error && (
    <div className="error" role="alert">
      <strong>That did not work.</strong> {error}
    </div>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Codebase Explainer</span>
        {repo && (
          <RepoForm
            id="repo-top"
            secondary
            value={repoInput}
            onChange={setRepoInput}
            onSubmit={(e) => { e.preventDefault(); openRepo(repoInput); }}
            loading={loadingRepo}
          />
        )}
      </header>

      {!repo ? (
       <section className="hero">
  <div className="hero-copy">
    <h1>Ask any public repository how it works</h1>
    <p className="lead">
      Answers point to the exact lines of code, and every citation is checked against the real file.
    </p>

    <RepoForm
      id="repo-hero"
      value={repoInput}
      onChange={setRepoInput}
      onSubmit={(e) => { e.preventDefault(); openRepo(repoInput); }}
      loading={loadingRepo}
    />

    {errorBox}

    <div className="chip-row">
<span className="muted">No repo in mind? Try one of these:</span>
      {EXAMPLE_REPOS.map((r) => (
        <button
          key={r}
          type="button"
          className="chip"
          onClick={() => { setRepoInput(r); openRepo(r); }}
        >
          {r}
        </button>
      ))}
    </div>
  </div>

  <div className="sample">
    <Citation c={SAMPLE} />
    <p className="muted">
      A sample citation. Each one shows the real lines from the repository.
    </p>
  </div>
</section>
      ) : (
        <div className="workspace">
          <aside className="rail" aria-label="Repository files">
            <div className="rail-head">
              <strong>{repo.owner}/{repo.repo}</strong>
              <span>{repo.files.length} files on {repo.branch}</span>
            </div>
            <FileTree files={repo.files} picked={picked} />
            {picked.size > 0 && (
              <p className="muted legend">A green dot marks files read for the latest answer.</p>
            )}
          </aside>

          <main className="stage">
            <form
              className="repo-form"
              onSubmit={(e) => { e.preventDefault(); runAsk(question); }}
            >
              <label className="sr-only" htmlFor="question">Question about this code</label>
              <input
                id="question"
                className="field"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Where is authentication handled?"
                autoComplete="off"
              />
              <button className="btn" disabled={!question.trim() || asking}>
                {asking ? "Reading..." : "Ask"}
              </button>
            </form>

            {errorBox}

            <div className="tabs" role="tablist">
              <button
                role="tab" className="tab"
                aria-selected={tab === "ask"}
                onClick={() => selectTab("ask")}
              >
                Answer
              </button>
              <button
                role="tab" className="tab"
                aria-selected={tab === "diagram"}
                onClick={() => selectTab("diagram")}
              >
                Diagram
              </button>
            </div>

            {tab === "ask" && (
              <section role="tabpanel" className="panel-stack" aria-live="polite">
                {asking && (
                  <div className="skeleton" aria-busy="true">
                    <p className="muted">
                      Choosing the relevant files and reading them. This usually takes 5 to 15 seconds.
                    </p>
                    <i /><i /><i />
                  </div>
                )}

                {!asking && !result && (
                  <div className="panel-stack">
                    <p className="muted">Not sure where to start? Try one of these.</p>
                    <div className="chip-row">
                      {STARTERS.map((s) => (
                        <button key={s} type="button" className="chip" onClick={() => runAsk(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!asking && result && (
                  <>
                    <h2 className="asked">{asked}</h2>
<p className="answer"><InlineText text={result.answer} /></p>

                    <div className="evidence-head">
                      <h3>Code behind this answer</h3>
                      <span className="muted">{result.citations.length} verified</span>
                    </div>

                    {result.citations.length === 0 && (
                      <p className="muted">
                        No citation passed verification, so double-check this answer in the files.
                      </p>
                    )}

                    {result.citations.map((c, i) => (
                      <Citation key={`${c.file}-${c.startLine}-${i}`} c={c} />
                    ))}

                    {result.rejected.length > 0 && (
                      <p className="muted">
                        Removed {result.rejected.length} citation(s) that did not match the real files.
                      </p>
                    )}

                    <p className="muted">
                      Read {result.picked.join(", ")} in {result.seconds} seconds.
                    </p>
                  </>
                )}
              </section>
            )}

            {tab === "diagram" && (
              <section role="tabpanel" className="panel-stack">
                {loadingGraph && (
                  <div className="skeleton" aria-busy="true">
                    <p className="muted">Reading imports from up to 60 files.</p>
                    <i /><i /><i />
                  </div>
                )}

                {graph && graph.files === 0 && (
                  <p className="muted">
                    This repo has no JavaScript or TypeScript files, so there is nothing to draw.
                  </p>
                )}

                {graph && graph.files > 0 && (
                  <>
                    <p className="muted">
                      {graph.files} files and {graph.edges} import links. An arrow means "imports".
                      {graph.capped && ` Showing the ${graph.files} shallowest of ${graph.totalCodeFiles} code files.`}
                    </p>
                    <DiagramView code={graph.mermaid} />
                  </>
                )}
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}