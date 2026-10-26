import { useMemo, useSyncExternalStore } from "react";
import { getToken, subscribeAuth } from "../../api/client";

export type Role = "passenger" | "staff" | "admin";

export interface Session {
  userId: number;
  email: string;
  role: Role;
}

/**
 * Reads who is signed in from the token's claims. This only decides which menus to show:
 * the token is not verified here, and the API checks it on every request.
 */
export function readSession(token: string | null): Session | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof json.exp === "number" && json.exp * 1000 < Date.now()) return null;
    const role: Role = json.role === "admin" || json.role === "staff" ? json.role : "passenger";
    return { userId: Number(json.sub), email: String(json.email ?? ""), role };
  } catch {
    return null;
  }
}

export function useSession(): Session | null {
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null);
  return useMemo(() => readSession(token), [token]);
}
