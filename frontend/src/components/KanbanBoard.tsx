"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { getBoard, saveBoard } from "@/lib/board";

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed",
};

export const KanbanBoard = ({ onLogout }: { onLogout?: () => void }) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const skipNextSave = useRef(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // Load the board from the backend on mount.
  useEffect(() => {
    let cancelled = false;
    getBoard()
      .then((data) => {
        if (cancelled) return;
        skipNextSave.current = true;
        setBoard(data);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the whole board on change, debounced so rapid edits collapse into one save.
  useEffect(() => {
    if (board === null) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveStatus("saving");
    const handle = setTimeout(() => {
      saveBoard(board)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, 500);
    return () => clearTimeout(handle);
  }, [board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) {
      return;
    }
    setBoard(
      (prev) =>
        prev && {
          ...prev,
          columns: moveCard(prev.columns, active.id as string, over.id as string),
        }
    );
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard(
      (prev) =>
        prev && {
          ...prev,
          columns: prev.columns.map((column) =>
            column.id === columnId ? { ...column, title } : column
          ),
        }
    );
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard(
      (prev) =>
        prev && {
          ...prev,
          cards: {
            ...prev.cards,
            [id]: { id, title, details: details || "No details yet." },
          },
          columns: prev.columns.map((column) =>
            column.id === columnId
              ? { ...column, cardIds: [...column.cardIds, id] }
              : column
          ),
        }
    );
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    setBoard(
      (prev) =>
        prev && {
          ...prev,
          cards: {
            ...prev.cards,
            [cardId]: { ...prev.cards[cardId], title, details },
          },
        }
    );
  };

  // The AI's board was already validated and persisted server-side (Part 9), so
  // refresh the UI without re-saving it (skip the next debounced PUT).
  const handleBoardUpdate = (next: BoardData) => {
    skipNextSave.current = true;
    setBoard(next);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard(
      (prev) =>
        prev && {
          ...prev,
          cards: Object.fromEntries(
            Object.entries(prev.cards).filter(([id]) => id !== cardId)
          ),
          columns: prev.columns.map((column) =>
            column.id === columnId
              ? {
                  ...column,
                  cardIds: column.cardIds.filter((id) => id !== cardId),
                }
              : column
          ),
        }
    );
  };

  if (loadStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading board...
      </div>
    );
  }

  if (loadStatus === "error" || board === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#c0392b]">
        Could not load your board. Please refresh.
      </div>
    );
  }

  const activeCard = activeCardId ? board.cards[activeCardId] : null;
  const saveLabel = SAVE_LABELS[saveStatus];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3">
                {saveLabel ? (
                  <span
                    role="status"
                    className="text-xs font-medium text-[var(--gray-text)]"
                  >
                    {saveLabel}
                  </span>
                ) : null}
                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                  >
                    Log out
                  </button>
                ) : null}
              </div>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <ChatSidebar onBoardUpdate={handleBoardUpdate} />
    </div>
  );
};
