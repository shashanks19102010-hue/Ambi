"use client";

import { useState } from "react";

export default function Composer({
  onSend,
  busy,
  webSearch
}: {
  onSend: (value: string) => void;
  busy: boolean;
  webSearch: boolean;
}) {
  const [value, setValue] = useState("");

  const send = () => {
    const text = value.trim();

    if (!text || busy) {
      return;
    }

    onSend(text);
    setValue("");
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          value={value}
          onChange={(event) =>
            setValue(event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Message Ambi…"
          aria-label="Message Ambi"
        />

        <div className="composer-row">
          <span className="pill">
            {webSearch
              ? "Web research enabled"
              : "Local-first mode"}
          </span>

          <button
            className="send"
            onClick={send}
            disabled={
              busy || !value.trim()
            }
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}