// Same-origin, credentialed AI chat against the FastAPI backend.

import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  board: BoardData | null;
};

export const sendChat = async (
  messages: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    throw new Error("Failed to reach the assistant");
  }
  return response.json();
};
