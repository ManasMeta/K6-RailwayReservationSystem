import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../../api/client";

/** Sends visitors without a session to sign in, then back to where they were headed. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/accounts" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
