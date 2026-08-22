"use client";

import type { AppSettings } from "@/types/chat";

export default function SettingsModal({
  settings,
  onChange,
  onClose
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.currentTarget === event.target &&
        onClose()
      }
    >
      <div className="modal">
        <h2>Ambi settings</h2>

        <div className="setting">
          <span>
            Web research

            <div className="small">
              Only sends queries externally when enabled.
            </div>
          </span>

          <input
            className="toggle"
            type="checkbox"
            checked={settings.webSearch}
            onChange={(event) =>
              onChange({
                ...settings,
                webSearch: event.target.checked
              })
            }
          />
        </div>

        <div className="setting">
          <span>
            Local memory

            <div className="small">
              Conversation data stays in browser storage.
            </div>
          </span>

          <input
            className="toggle"
            type="checkbox"
            checked={settings.memoryEnabled}
            onChange={(event) =>
              onChange({
                ...settings,
                memoryEnabled: event.target.checked
              })
            }
          />
        </div>

        <div className="setting">
          <span>
            Auto recovery
          </span>

          <input
            className="toggle"
            type="checkbox"
            checked={settings.autoRecover}
            onChange={(event) =>
              onChange({
                ...settings,
                autoRecover: event.target.checked
              })
            }
          />
        </div>

        <div className="setting">
          <span>
            Safety mode
          </span>

          <select
            value={settings.safetyMode}
            onChange={(event) =>
              onChange({
                ...settings,
                safetyMode:
                  event.target.value as AppSettings[
                    "safetyMode"
                  ]
              })
            }
          >
            <option value="strict">
              Strict
            </option>

            <option value="balanced">
              Balanced
            </option>
          </select>
        </div>

        <div className="setting">
          <span>
            Local model
          </span>

          <select
            value={settings.model}
            onChange={(event) =>
              onChange({
                ...settings,
                model: event.target.value
              })
            }
          >
            <option value="LFM2.5-350M-Instruct-q4f16_1-MLC">
              LFM2.5 350M
            </option>

            <option value="LFM2.5-230M-Instruct-q4f16_1-MLC">
              LFM2.5 230M
            </option>
          </select>
        </div>

        <button
          className="new-chat"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}