import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, getToken } from "../../api/client";
import AccountsPage from "./AccountsPage";
import { RequireAuth } from "./RequireAuth";

const apiUser = {
  user_id: 7,
  email: "asha@example.com",
  full_name: "Asha Rao",
  phone: "9876543210",
  role: "passenger",
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/book" element={<RequireAuth><p>Booking screen</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AccountsPage", () => {
  it("signs in through the API and keeps the token for later requests", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { access_token: "jwt-123", user: apiUser } });
    vi.spyOn(api, "get").mockResolvedValue({ data: [] });
    renderAt("/accounts");

    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/Welcome, Asha/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "asha@example.com",
      password: "correct horse",
    });
    expect(getToken()).toBe("jwt-123");
  });

  it("shows the server's reason when sign-in fails and stores nothing", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: "Incorrect email or password", code: "AUTH_INVALID" } },
    });
    renderAt("/accounts");

    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(getToken()).toBeNull();
  });

  it("rejects a short password before calling the API", async () => {
    const post = vi.spyOn(api, "post");
    renderAt("/accounts");

    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await userEvent.type(screen.getByLabelText("Full name"), "Asha Rao");
    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Phone number"), "9876543210");
    await userEvent.type(screen.getByLabelText(/Password/), "short");
    const form = screen.getByRole("button", { name: /create account/i }).closest("form")!;
    form.noValidate = true;
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8 characters");
    expect(post).not.toHaveBeenCalled();
  });

  it("resumes a stored session and logs out cleanly", async () => {
    localStorage.setItem("nrrms_token", "jwt-123");
    vi.spyOn(api, "get").mockImplementation(async (url: string) => ({
      data: url === "/me" ? apiUser : [],
    }));
    renderAt("/accounts");

    expect(await screen.findByText(/Welcome, Asha/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => expect(getToken()).toBeNull());
    expect(screen.getByRole("heading", { name: /sign in to yatrio/i })).toBeInTheDocument();
  });

  it("drops a token the server no longer accepts", async () => {
    localStorage.setItem("nrrms_token", "expired");
    vi.spyOn(api, "get").mockRejectedValue(new Error("401"));
    renderAt("/accounts");

    expect(await screen.findByRole("heading", { name: /sign in to yatrio/i })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});

describe("RequireAuth", () => {
  it("sends signed-out visitors to sign in", async () => {
    renderAt("/book?train=12424");
    expect(await screen.findByRole("heading", { name: /sign in to yatrio/i })).toBeInTheDocument();
    expect(screen.queryByText("Booking screen")).not.toBeInTheDocument();
  });

  it("lets signed-in visitors through", () => {
    localStorage.setItem("nrrms_token", "jwt-123");
    renderAt("/book");
    expect(screen.getByText("Booking screen")).toBeInTheDocument();
  });
});
