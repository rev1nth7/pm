import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-4 w-4"
  >
    <path
      fillRule="evenodd"
      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
      clipRule="evenodd"
    />
  </svg>
);

const GripIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-4 w-4"
  >
    <path
      fillRule="evenodd"
      d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z"
      clipRule="evenodd"
    />
    <path
      fillRule="evenodd"
      d="M5 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM5 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM6.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM15 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM16.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z"
      clipRule="evenodd"
    />
  </svg>
);

type KanbanCardProps = {
  card: Card;
  columnId: string;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, columnId, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `card-${card.id}`,
      data: { cardId: card.id, columnId },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group cursor-grab rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_8px_16px_rgba(3,33,71,0.06)]",
        "transition-all duration-150",
        isDragging && "cursor-grabbing opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0 text-[var(--gray-text)] opacity-0 transition-opacity group-hover:opacity-60">
          <GripIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-tight text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="shrink-0 rounded-lg p-1.5 text-[var(--gray-text)] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label={`Delete ${card.title}`}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
};
