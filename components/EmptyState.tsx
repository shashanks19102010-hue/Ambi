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
        <p className="welcome-kicker">CALM BY DESIGN · GROQ AI</p>
        <h1 id="welcome-title">What are we creating today?</h1>
        <p className="welcome-subtitle">
          Ambi is a calm, capable workspace for conversation, coding, research,
          study, and focused thinking — with your privacy controls always in view.
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
        <span>Groq AI</span>
        <i />
        <span>Private Memory</span>
        <i />
        <span>Research</span>
        <i />
        <span>Safe Tools</span>
      </div>

      <p className="privacy-note">
        <span>CONTROLLED</span> Your chat stays local until you explicitly use an
        external feature such as cloud AI or web research.
      </p>
    </section>
  );
}
