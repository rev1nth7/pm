import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { initialData } from "@/lib/kanban";
import * as chatApi from "@/lib/chat";

vi.mock("@/lib/chat");

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: /ask ai/i }));
};

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText(/message the assistant/i), text);
  await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
};

describe("ChatSidebar", () => {
  it("sends a message and shows the user message then the assistant reply", async () => {
    vi.mocked(chatApi.sendChat).mockResolvedValue({ reply: "Done!", board: null });
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    await open();

    await send("add a card");

    expect(screen.getByText("add a card")).toBeInTheDocument();
    expect(await screen.findByText("Done!")).toBeInTheDocument();
    expect(chatApi.sendChat).toHaveBeenCalledWith([
      { role: "user", content: "add a card" },
    ]);
  });

  it("calls onBoardUpdate when the response carries a board", async () => {
    const board = structuredClone(initialData);
    vi.mocked(chatApi.sendChat).mockResolvedValue({ reply: "Added.", board });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await open();

    await send("add a card");

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalledWith(board));
  });

  it("shows an error and keeps the typed message when the call fails", async () => {
    vi.mocked(chatApi.sendChat).mockRejectedValue(new Error("boom"));
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    await open();

    await send("add a card");

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.getByLabelText(/message the assistant/i)).toHaveValue("add a card");
  });
});
