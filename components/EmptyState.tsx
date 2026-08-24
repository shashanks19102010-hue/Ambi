export default function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    ["Explain something", "Make a difficult topic simple"],
    ["Build something", "Plan, code, debug, or refactor"],
    ["Research a topic", "Find current information and sources"],
    ["Help me study", "Learn step by step with examples"],
    ["Brainstorm", "Turn an idea into a clear plan"],
    ["Analyze", "Reason through text or a problem"],
  ] as const;
  return <div className="empty"><div className="empty-inner"><div className="orb"><img src="/ambi-logo.png" alt="Ambi"/></div><div className="eyebrow">CALM AI · GROQ CLOUD</div><h1>What can we work on?</h1><p>A calm, capable workspace for chat, coding, research and study. Pick a starting point or ask anything.</p><div className="suggestions">{suggestions.map(([title, sub]) => <button className="suggestion" key={title} onClick={() => onSuggestion(title)}><strong>{title}</strong><small>{sub}</small></button>)}</div><div className="capabilities"><span>Groq AI</span><i/><span>Private Memory</span><i/><span>Web Research</span><i/><span>Safe Tools</span></div></div></div>;
}
