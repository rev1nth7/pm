import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";
import * as boardApi from "@/lib/board";
import * as chatApi from "@/lib/chat";

vi.mock("@/lib/board");
vi.mock("@/lib/chat");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(boardApi.getBoard).mockResolvedValue(structuredClone(initialData));
  vi.mocked(boardApi.saveBoard).mockResolvedValue(structuredClone(initialData));
});

const findFirstColumn = async () => (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  it("loads and renders columns from the API", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(boardApi.getBoard).toHaveBeenCalled();
  });

  it("renames a column and persists", async () => {
    render(<KanbanBoard />);
    const column = await findFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    await waitFor(() => expect(boardApi.saveBoard).toHaveBeenCalled());
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = await findFirstColumn();
    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits a card's title and persists", async () => {
    render(<KanbanBoard />);
    const column = await findFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(within(column).getByRole("button", { name: /^save$/i }));

    expect(within(column).getByText("Updated title")).toBeInTheDocument();
    await waitFor(() => expect(boardApi.saveBoard).toHaveBeenCalled());
  });

  it("refreshes from an AI chat board update without re-saving", async () => {
    const updated = structuredClone(initialData);
    updated.cards["card-ai"] = { id: "card-ai", title: "AI card", details: "" };
    updated.columns[0].cardIds.push("card-ai");
    vi.mocked(chatApi.sendChat).mockResolvedValue({ reply: "Added it.", board: updated });

    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByRole("button", { name: /ask ai/i }));
    await userEvent.type(
      screen.getByLabelText(/message the assistant/i),
      "add an AI card"
    );
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    // The board reflects the AI's change...
    expect(await screen.findByText("AI card")).toBeInTheDocument();
    // ...and the already-persisted board is not saved again.
    expect(boardApi.saveBoard).not.toHaveBeenCalled();
  });
});
