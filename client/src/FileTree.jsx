import { useMemo } from "react";

// Turns ["lib/a.js", "lib/b.js", "index.js"] into a nested folder structure
function buildTree(files) {
  const root = { dirs: {}, files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      node = node.dirs[part] ??= { dirs: {}, files: [] };
    }
    node.files.push({ name: parts[parts.length - 1], path: f.path });
  }
  return root;
}

function containsPicked(node, picked) {
  return (
    node.files.some((f) => picked.has(f.path)) ||
    Object.values(node.dirs).some((d) => containsPicked(d, picked))
  );
}

function Branch({ node, picked }) {
  const dirNames = Object.keys(node.dirs).sort();
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul className="tree">
      {dirNames.map((name) => (
        <li key={name}>
          <details open={containsPicked(node.dirs[name], picked)}>
            <summary>{name}</summary>
            <Branch node={node.dirs[name]} picked={picked} />
          </details>
        </li>
      ))}
      {files.map((f) => (
        <li key={f.path} className={picked.has(f.path) ? "file read" : "file"}>
          {f.name}
        </li>
      ))}
    </ul>
  );
}

export default function FileTree({ files, picked }) {
  const tree = useMemo(() => buildTree(files), [files]);
  return <Branch node={tree} picked={picked} />;
}