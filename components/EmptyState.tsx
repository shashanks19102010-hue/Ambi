export default function EmptyState({
  onSuggestion,
}: {
  onSuggestion?: (text: string) => void;
}) {
  const suggestions = [
    ["Explain something", "Make any topic easy to understand"],
    ["Build something", "Plan, code, debug, or refactor"],
    ["Research a topic", "Compare current information with sources"],
    ["Analyze a file", "Extract, summarize, and reason about documents"],
    ["Help me study", "Learn step by step with quizzes and hints"],
    ["Brainstorm ideas", "Turn a rough idea into a clear plan"],
  ] as const;

  return (
    <section className="empty" aria-labelledby="welcome-title">
      <div className="welcome-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
        <img src="/ambi-logo.png" alt="" className="empty-logo" />
      </div>

      <div className="welcome-copy">
        <p className="welcome-kicker">LOCAL-FIRST · CALM BY DESIGN</p>
        <h1 id="welcome-title">What are we creating today?</h1>
        <p className="welcome-subtitle">
          Ambi is a quiet, capable workspace for conversation, coding,
          research, study, and private thinking — with local AI at its core.
        </p>
      </div>

      <div className="suggestions">
        {suggestions.map(([title, description]) => (
          <button
            key={title}
            onClick={() => onSuggestion?.(title)}
            type="button"
          >
            <span className="suggestion-copy">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <span className="suggestion-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        ))}
      </div>

      <div className="capability-strip" aria-label="Ambi capabilities">
        <span>Local AI</span>
        <i />
        <span>Private Memory</span>
        <i />
        <span>Research</span>
        <i />
        <span>Safe Tools</span>
      </div>

      <p className="privacy-note">
        <span>LOCAL</span> Your chat remains on this device unless you explicitly
        enable an external feature such as web research.
      </p>
    </section>
  );
}
