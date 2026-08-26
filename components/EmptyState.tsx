export default function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    ["Explain a topic", "Make a difficult idea simple"],
    ["Build something", "Plan, code, debug, or refactor"],
    ["Work with files", "Analyze notes, PDFs, or documents"],
    ["Help me study", "Learn step by step with examples"],
    ["Explore ideas", "Brainstorm and shape a clear plan"],
    ["Research", "Find current information when enabled"],
  ] as const;
  return <div className="empty"><div className="empty-inner"><div className="orb"><img src="/ambi-logo.png" alt="Ambi"/></div><div className="eyebrow">CALM AI · LOCAL-FIRST</div><h1>What can I help with?</h1><p>A calm, capable workspace for chat, coding, research and study — designed to stay private, focused and easy to use.</p><div className="suggestions">{suggestions.map(([title, sub]) => <button className="suggestion" key={title} onClick={() => onSuggestion(title)}><strong>{title}</strong><small>{sub}</small></button>)}</div><div className="capabilities"><span>Private Memory</span><i/><span>Local-first</span><i/><span>Safe Tools</span><i/><span>Recovery ready</span></div></div></div>;
}
