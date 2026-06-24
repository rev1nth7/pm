"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe, logout as apiLogout } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Login } from "@/components/Login";

type AuthStatus = "loading" | "in" | "out";

export const AuthGate = () => {
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    const me = await getMe();
    setStatus(me.authenticated ? "in" : "out");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = async () => {
    await apiLogout();
    setStatus("out");
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading...
      </div>
    );
  }

  if (status === "out") {
    return <Login onSuccess={() => setStatus("in")} />;
  }

  return <KanbanBoard onLogout={handleLogout} />;
};
