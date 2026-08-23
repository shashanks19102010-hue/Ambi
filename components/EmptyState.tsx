export default function EmptyState({ onSuggestion }: { onSuggestion?: (text: string) => void }) {
  const suggestions = ["Explain something simply", "Help me code", "Research a current topic", "Analyze a file", "Help me study", "Brainstorm ideas"];
  return <div className="empty"><img src="/ambi-logo.png" alt="Ambi" className="empty-logo" /><h1>How can I help?</h1><p>Local-first AI for conversation, coding, research, study, and your private workspace.</p><div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => onSuggestion?.(suggestion)}>{suggestion}<span>↗</span></button>)}</div><div className="privacy-note"><span>LOCAL</span> Your conversation stays on this device unless you enable an external feature such as web research.</div></div>;
}
