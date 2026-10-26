import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../../api/client";
import { type Role, useSession } from "./session";

/** Sends visitors without a session to sign in, then back to where they were headed. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/accounts" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Like RequireAuth, and tells signed-in users without the right role why they cannot see the page. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const location = useLocation();
  const session = useSession();
  if (!getToken()) {
    return <Navigate to="/accounts" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!session || !roles.includes(session.role)) {
    return (
      <main className="page">
        <h1>Not allowed</h1>
        <p className="muted">This page is for {roles.join(" or ")} accounts.</p>
      </main>
    );
  }
  return <>{children}</>;
}
