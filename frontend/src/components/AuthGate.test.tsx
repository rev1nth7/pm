import { render, screen } from "@testing-library/react";
import { AuthGate } from "@/components/AuthGate";
import * as auth from "@/lib/auth";

vi.mock("@/lib/auth");

describe("AuthGate", () => {
  it("shows the login screen when not authenticated", async () => {
    vi.mocked(auth.getMe).mockResolvedValue({
      authenticated: false,
      username: null,
    });
    render(<AuthGate />);

    expect(
      await screen.findByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("shows the board when authenticated", async () => {
    vi.mocked(auth.getMe).mockResolvedValue({
      authenticated: true,
      username: "user",
    });
    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });
});
