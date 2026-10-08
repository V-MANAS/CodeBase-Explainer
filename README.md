# Codebase Explainer

> AI-powered codebase analysis for understanding unfamiliar GitHub repositories with verified code evidence.

## Overview

Codebase Explainer helps developers understand an unfamiliar public GitHub repository without manually opening dozens of files.

Give it a GitHub repository URL, ask a question about the codebase, and it:

1. Loads and filters the repository file tree.
2. Uses an AI model to select the most relevant files.
3. Fetches only the selected source files.
4. Limits the amount of code sent to the model.
5. Generates an answer with file and line citations.
6. Verifies those citations against the actual fetched files.
7. Extracts real code snippets for the UI.
8. Can generate a JavaScript/TypeScript architecture diagram from imports.

The important design principle is that **AI performs reasoning, while deterministic backend code handles retrieval, limits, validation, and citation verification.**

---

## Features

### Repository Explorer
- Load a public GitHub repository from its URL.
- Display a filtered file tree.
- Ignore common repository noise such as `node_modules`, lock files, build output, images, and GitHub metadata.

### AI Codebase Q&A

Ask questions such as:

> How does routing work?

> Where is the app object created?

> How are errors handled?

The system selects relevant files before generating an answer.

### Verified Citations

Answers include citations containing:

- File path
- Starting line
- Ending line
- Reason the citation is relevant

The backend validates each citation against the actual fetched source files before returning it to the frontend.

### Real Code Snippets

Verified citation ranges are extracted from the actual repository content and displayed alongside the answer.

This prevents the UI from presenting fabricated code as evidence.

### Architecture Diagram

For JavaScript/TypeScript repositories, the application analyzes relative imports and generates an architecture diagram using Mermaid.

The current implementation focuses on:
- JavaScript
- TypeScript
- Relative imports
- Shallow repository architecture

It does not use AI for diagram generation.

### Basic Abuse Protection

The backend includes:
- Per-IP question rate limiting
- Global daily question cap
- Maximum question length
- Configurable CORS
- Environment-based configuration

### Benchmarking

A fixed benchmark is included to evaluate:
- Relevant file selection
- Citation validity
- Response time
- Stability across repeated runs

The benchmark currently contains questions covering repositories such as Express, Koa, Axios, and Fastify.

---

## How It Works

```text
                    GitHub Repository
                           │
                           ▼
                    Repository Tree
                           │
                           ▼
                   Filter Repository
                           │
                           ▼
                  ┌─────────────────┐
                  │   AI Call #1    │
                  │ Select relevant │
                  │     files       │
                  └────────┬────────┘
                           │
                           ▼
                  Fetch selected files
                           │
                           ▼
                 Limit + number lines
                           │
                           ▼
                  ┌─────────────────┐
                  │   AI Call #2    │
                  │ Answer question │
                  │ + citations     │
                  └────────┬────────┘
                           │
                           ▼
                  Verify citations
                           │
                           ▼
                  Extract real code
                           │
                           ▼
                    Frontend result
```

### Two-stage AI pipeline

The application deliberately separates file selection from answer generation.

#### Call 1 — File Selection

The model receives repository paths rather than the entire codebase and selects the files most likely to answer the question.

The backend then checks that returned paths actually exist in the repository.

#### Call 2 — Answer Generation

Only the selected files are fetched and sent to the model with line numbers.

The model returns an answer and citation ranges.

The backend then verifies those citation ranges against the fetched files.

This keeps the system more controlled than simply sending an entire repository to an LLM.

---

## Citation Verification

Citation verification is one of the core engineering components.

For every returned citation, the backend checks:

```text
Does the file exist?
        │
        ▼
Are startLine/endLine integers?
        │
        ▼
Are the line numbers within the file?
        │
        ▼
Extract the real source lines
        │
        ▼
Return verified snippet
```

Invalid citations are rejected rather than blindly displayed.

The system also limits the size of returned snippets.

### Important limitation

Citation verification proves that a cited file and line range exist. It does **not** prove that the cited lines semantically support the answer.

The benchmark and manual review process therefore also consider citation relevance.

---

## Architecture Diagram

The architecture diagram is generated without an LLM.

The backend:

1. Finds JavaScript/TypeScript source files.
2. Parses relative imports using lightweight parsing/regex logic.
3. Resolves relative paths.
4. Builds file-to-file relationships.
5. Groups files by directory.
6. Produces Mermaid diagram syntax.
7. The React frontend renders the Mermaid output.

Conceptually:

```text
Source files
     │
     ▼
Import analysis
     │
     ▼
Dependency relationships
     │
     ▼
Mermaid graph
     │
     ▼
Interactive frontend diagram
```

---

## Tech Stack

### Frontend

- React
- Vite
- CSS
- Mermaid

### Backend

- Node.js
- Express
- CORS
- `express-rate-limit`

### AI

- Google Gemini API

### Repository Integration

- GitHub repository tree/content APIs

### Evaluation

- Node.js benchmark harness
- Fixed benchmark questions
- Repeated-run evaluation

---

## Project Structure

```text
CodeBase-project/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── Citation.jsx
│   │   ├── DiagramView.jsx
│   │   ├── FileTree.jsx
│   │   ├── InlineText.jsx
│   │   ├── api.js
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── index.js
│   │   └── services/
│   │       ├── ai.js
│   │       ├── ask.js
│   │       ├── github.js
│   │       └── importGraph.js
│   ├── benchmark.js
│   ├── benchmark.json
│   ├── benchmark-results.json
│   ├── benchmark-baseline-v1.json
│   ├── test-ask.js
│   ├── test-github.js
│   └── package.json
│
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js
- A Google Gemini API key
- A GitHub token is recommended for GitHub API access

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/codebase-explainer.git
cd codebase-explainer
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

```bash
cd ../server
npm install
```

### 4. Configure backend environment variables

Create:

```text
server/.env
```

Example:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_working_gemini_model
GITHUB_TOKEN=your_github_token

CLIENT_ORIGIN=http://localhost:5173
DAILY_QUESTION_CAP=200
```

Do not commit `.env` or API keys to Git.

### 5. Start the backend

From `server/`:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:3001
```

### 6. Start the frontend

Open another terminal:

```bash
cd client
npm run dev
```

The Vite development server normally runs on:

```text
http://localhost:5173
```

Open the displayed Vite URL in your browser.

---

## API

### Health Check

```http
GET /health
```

Returns:

```json
{
  "ok": true
}
```

### Load Repository

```http
POST /api/repo
```

Request:

```json
{
  "repoUrl": "https://github.com/expressjs/express"
}
```

Returns repository metadata and the filtered file tree.

### Ask a Question

```http
POST /api/ask
```

Request:

```json
{
  "repoUrl": "https://github.com/expressjs/express",
  "question": "How does routing work?"
}
```

The response contains the generated answer, verified citations, snippets, and related metadata.

### Architecture Graph

```http
POST /api/graph
```

Request:

```json
{
  "repoUrl": "https://github.com/expressjs/express"
}
```

Returns the generated architecture graph data used by the frontend.

---

## Evaluation

The project includes a fixed benchmark rather than relying only on manual testing.

The benchmark contains questions across multiple repositories and tests whether the system can select expected files for questions about real implementation details.

Example questions include:

```text
Where is the app object created?

How does routing work?

How does res.send work?

How does Koa handle errors thrown inside middleware?

How do request and response interceptors run?

How does a route get registered?
```

### Metrics

The evaluation focuses on:

- **File-selection accuracy** — whether relevant expected files were selected.
- **Citation validity** — whether returned citations point to real file/line ranges.
- **Response time** — how long requests take.
- **Stability** — whether repeated runs produce consistent results.

The project also includes manual trust/boundary testing for questions whose answers are not contained in the repository.

---

## Security and Reliability

The current backend includes:

- Question length validation
- Per-IP rate limiting
- Global daily question cap
- Configurable CORS
- Environment variables for secrets
- Repository/file limits to control model input
- Citation verification
- Filtered repository trees

The application currently targets **public GitHub repositories**.

---

## Current Limitations

This version intentionally keeps the architecture simple.

- Only public repositories are supported.
- The system reads a limited number of lines from each selected file.
- AI file selection and answers can vary between runs.
- Citation verification checks structural validity, not complete semantic correctness.
- The architecture diagram currently focuses on JavaScript/TypeScript imports.
- In-memory caching is not persistent across server restarts.
- Large repositories may require additional handling.

These limitations are intentionally documented rather than hidden.

---

## Future Improvements

Potential next steps include:

### Engineering

- Automated unit/integration tests
- GitHub Actions CI
- Persistent PostgreSQL cache
- Better handling of very large repositories
- Cache expiration
- Docker support

### Retrieval

- Keyword-assisted file search
- Measured retrieval improvements
- More robust import resolution
- Python dependency graphs

### Product

- Saved question history
- Shareable answer links
- Follow-up questions
- File viewer with syntax highlighting
- Repository overview
- Request/code-flow tracing
- Export answers as Markdown
- User feedback and usage analytics

Embeddings/vector databases and more advanced RAG techniques are intentionally not required for the current architecture.

---

## Design Philosophy

The project follows a simple principle:

> **Use AI where reasoning is useful, and deterministic code where correctness can be enforced.**

The AI is responsible for:
- Selecting relevant files
- Understanding source code
- Generating explanations

The backend is responsible for:
- Fetching repository data
- Filtering files
- Limiting input
- Validating paths
- Verifying citations
- Extracting real code snippets
- Enforcing request limits

This separation makes the system easier to reason about, test, and improve.

---

## Status

**Current status: Working v1**

The current version has been tested end-to-end locally with repository loading, AI codebase Q&A, citation verification, code snippets, architecture visualization, unsupported-question handling, boundary testing, and request protection.

---

## License

Add a license here if you decide to open-source the project.
