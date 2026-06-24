import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "@/components/Login";
import * as auth from "@/lib/auth";

vi.mock("@/lib/auth");

describe("Login", () => {
  it("shows an error when credentials are rejected", async () => {
    vi.mocked(auth.login).mockRejectedValue(new Error("bad"));
    render(<Login onSuccess={() => {}} />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid username or password/i)
    ).toBeInTheDocument();
  });

  it("calls onSuccess when login succeeds", async () => {
    vi.mocked(auth.login).mockResolvedValue({
      authenticated: true,
      username: "user",
    });
    const onSuccess = vi.fn();
    render(<Login onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
