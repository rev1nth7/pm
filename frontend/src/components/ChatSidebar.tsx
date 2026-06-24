"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendChat, type ChatMessage } from "@/lib/chat";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    transcriptRef.current?.scrollTo?.({ top: transcriptRef.current.scrollHeight });
  }, [messages, pending]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) {
      return;
    }

    const history = [...messages, { role: "user", content } as ChatMessage];
    setMessages(history);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const { reply, board } = await sendChat(history);
      setMessages([...history, { role: "assistant", content: reply }]);
      if (board) {
        onBoardUpdate(board);
      }
    } catch {
      // Preserve the typed message so the user can retry.
      setInput(content);
      setMessages(messages);
      setError("The assistant is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        Ask AI
      </button>
    );
  }

  return (
    <aside
      aria-label="AI assistant"
      className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-sm flex-col border-l border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] backdrop-blur"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Ask AI
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close assistant"
          className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
        >
          Close
        </button>
      </header>

      <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me to add, edit, move, or rename cards and columns on your board.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              data-role={message.role}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-[var(--primary-blue)] px-4 py-2 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))
        )}
        {pending ? (
          <p role="status" className="text-xs font-medium text-[var(--gray-text)]">
            Thinking...
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-[#c0392b]">
            {error}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-[var(--stroke)] px-5 py-4"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder="Ask the assistant..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
