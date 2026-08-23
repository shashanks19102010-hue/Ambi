"use client";

export default function MobileControls() {
  const emit = (name: "ambi:open-history" | "ambi:new-chat") => {
    window.dispatchEvent(new CustomEvent(name));
  };

  return (
    <div className="mobile-controls" aria-label="Mobile chat controls">
      <button type="button" onClick={() => emit("ambi:open-history")} aria-label="Open chat history">☰</button>
      <button type="button" onClick={() => emit("ambi:new-chat")} aria-label="Start a new chat">＋</button>
    </div>
  );
}
