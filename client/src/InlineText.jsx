// The model writes `like this` for code names. Turn those into real <code> elements.
export default function InlineText({ text }) {
  const parts = text.split(/`([^`]+)`/g); // odd positions are the text between backticks
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="inline-code">{part}</code>
    ) : (
      part
    )
  );
}