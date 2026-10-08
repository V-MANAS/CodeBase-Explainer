const API =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
  
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const loadRepo = (repoUrl) => post("/api/repo", { repoUrl });
export const askQuestion = (repoUrl, question) =>
  post("/api/ask", { repoUrl, question });
export const loadGraph = (repoUrl) => post("/api/graph", { repoUrl });