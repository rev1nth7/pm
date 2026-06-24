// Same-origin, credentialed board persistence against the FastAPI backend.

import type { BoardData } from "@/lib/kanban";

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load board");
  }
  return response.json();
};

export const saveBoard = async (board: BoardData): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error("Failed to save board");
  }
  return response.json();
};
