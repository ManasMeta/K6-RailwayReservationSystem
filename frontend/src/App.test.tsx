import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { api, getToken, setToken } from "./api/client";
import { readSession } from "./features/accounts/session";

/** A token shaped like the API's (unsigned: the UI only reads the claims). */
function tokenFor(role: string, expiresInSeconds = 3600): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: "HS256" })}.${encode({ sub: "7", email: "u@example.com", role, exp })}.sig`;
}

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function nav() {
  return screen.getByRole("navigation", { name: "Main" });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(api, "get").mockResolvedValue({ data: [] });
});

describe("readSession", () => {
  it("reads the role from the token", () => {
    expect(readSession(tokenFor("staff"))).toMatchObject({ userId: 7, role: "staff" });
  });

  it("treats an expired, missing or malformed token as signed out", () => {
    expect(readSession(tokenFor("admin", -60))).toBeNull();
    expect(readSession(null)).toBeNull();
    expect(readSession("not-a-token")).toBeNull();
  });

  it("never invents a role: unknown roles are passengers", () => {
    expect(readSession(tokenFor("superuser"))?.role).toBe("passenger");
  });
});

describe("navigation by role", () => {
  it("shows only public links when signed out", () => {
    renderApp("/pnr-status");
    expect(nav()).toHaveTextContent("Search trains");
    expect(nav()).toHaveTextContent("Sign in");
    expect(nav()).not.toHaveTextContent("Wallet");
    expect(nav()).not.toHaveTextContent("Operations");
  });

  it("gives passengers their journeys and wallet but not operations", () => {
    setToken(tokenFor("passenger"));
    renderApp("/pnr-status");
    expect(nav()).toHaveTextContent("My journeys");
    expect(nav()).toHaveTextContent("Wallet");
    expect(nav()).not.toHaveTextContent("Operations");
  });

  it("gives staff the operations console", () => {
    setToken(tokenFor("staff"));
    renderApp("/pnr-status");
    expect(nav()).toHaveTextContent("Operations");
    expect(nav()).not.toHaveTextContent("analytics");
  });

  it("gives admins operations and analytics", () => {
    setToken(tokenFor("admin"));
    renderApp("/pnr-status");
    expect(nav()).toHaveTextContent("Operations & analytics");
  });

  it("signing out clears the token and the menu", async () => {
    setToken(tokenFor("passenger"));
    renderApp("/pnr-status");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(getToken()).toBeNull();
    expect(nav()).not.toHaveTextContent("Wallet");
  });
});

describe("protected routes", () => {
  it("sends a signed-out visitor from /operations to sign in", async () => {
    renderApp("/operations");
    expect(await screen.findByRole("heading", { name: /sign in to railyatri/i })).toBeInTheDocument();
  });

  it("tells a passenger the operations console is not for them", () => {
    setToken(tokenFor("passenger"));
    renderApp("/operations");
    expect(screen.getByRole("heading", { name: "Not allowed" })).toBeInTheDocument();
  });
});
