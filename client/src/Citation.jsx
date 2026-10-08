import { useState } from "react";
import InlineText from "./InlineText";

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2 6.5l2.6 2.5L10 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Citation({ c }) {
  const [copied, setCopied] = useState(false);
  const lines = c.snippet.split("\n");
  const range =
  c.startLine === c.endLine
    ? `line ${c.startLine}`
    : `lines ${c.startLine} to ${c.endLine}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked by the browser, so fail quietly */
    }
  }

  return (
    <figure className="citation">
      <figcaption className="citation-head">
        <span className="path">{c.file}</span>
        <span className="range">{range}</span>
        <span className="verified"><CheckIcon /> Verified</span>
        <button type="button" className="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </figcaption>

      {c.why && <p className="why"><InlineText text={c.why} /></p>}

      <pre className="code" style={{ "--start": c.startLine }}>
        <code>
          {lines.map((line, i) => (
            <span className="line" key={i}>{line}</span>
          ))}
        </code>
      </pre>
    </figure>
  );
}