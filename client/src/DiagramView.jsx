import { useEffect, useRef, useState } from "react";

// Tokens that use light-dark() are not readable as plain colors,
// so let the browser resolve them on a temporary element.
function resolveColor(token) {
  const el = document.createElement("span");
  el.style.color = `var(${token})`;
  document.body.appendChild(el);
  const color = getComputedStyle(el).color;
  el.remove();
  return color;
}

export default function DiagramView({ code }) {
  const holder = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
            background: resolveColor("--surface"),
            primaryColor: resolveColor("--surface"),
            primaryTextColor: resolveColor("--ink"),
            primaryBorderColor: resolveColor("--line"),
            lineColor: resolveColor("--faint"),
            clusterBkg: resolveColor("--sunken"),
            clusterBorder: resolveColor("--line"),
          },
        });

        const { svg } = await mermaid.render(`diagram-${Date.now()}`, code);
        if (!cancelled && holder.current) holder.current.innerHTML = svg;
      } catch (err) {
        if (!cancelled) setError("Could not draw the diagram.");
        console.error(err);
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <div className="error" role="alert">{error}</div>;
  return <div ref={holder} className="diagram" />;
}