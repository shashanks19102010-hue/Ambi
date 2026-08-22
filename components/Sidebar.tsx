import type { Conversation } from "@/types/chat";

export default function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onSettings
}: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        ◐ Ambi
      </div>

      <button
        className="new-chat"
        onClick={onNew}
      >
        ＋ New chat
      </button>

      <div className="chat-list">
        {conversations.map((chat) => (
          <button
            key={chat.id}
            className={`chat-item ${
              chat.id === activeId
                ? "active"
                : ""
            }`}
            onClick={() =>
              onSelect(chat.id)
            }
          >
            {chat.title ||
              "New conversation"}
          </button>
        ))}
      </div>

      <div className="side-bottom">
        <button
          className="side-button"
          onClick={onSettings}
        >
          ⚙ Settings
        </button>
      </div>
    </aside>
  );
}