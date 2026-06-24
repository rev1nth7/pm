// Same-origin auth calls against the FastAPI backend. The session lives in an
// HTTP-only cookie, so every request is sent with credentials.

export type Me = {
  authenticated: boolean;
  username: string | null;
};

export const getMe = async (): Promise<Me> => {
  const response = await fetch("/api/me", { credentials: "include" });
  if (!response.ok) {
    return { authenticated: false, username: null };
  }
  return response.json();
};

export const login = async (username: string, password: string): Promise<Me> => {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid username or password");
  }
  return response.json();
};

export const logout = async (): Promise<void> => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
};
