import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { WalletPage } from "./WalletPage";

vi.mock("./api");

const statement = {
  items: [
    {
      ledger_txn_id: 2,
      type: "PAYMENT" as const,
      reference_id: "1000000001",
      description: "Wallet payment for PNR 1000000001",
      amount: "400.00",
      direction: "DEBIT" as const,
      balance_after: "600.00",
      created_at: "2026-11-02T09:30:00Z",
    },
    {
      ledger_txn_id: 1,
      type: "TOPUP" as const,
      reference_id: "1",
      description: "Simulated UPI wallet top-up",
      amount: "1000.00",
      direction: "CREDIT" as const,
      balance_after: "1000.00",
      created_at: "2026-11-02T09:00:00Z",
    },
  ],
  limit: 10,
  offset: 0,
  total: 2,
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WalletPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getWallet).mockResolvedValue({ wallet_id: 1, balance: "600.00", currency: "INR" });
  vi.mocked(api.getStatement).mockResolvedValue(statement);
});

describe("WalletPage", () => {
  it("shows the balance and a statement with running balances", async () => {
    setup();

    expect(await screen.findByText("₹600.00", { selector: "strong" })).toBeInTheDocument();
    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[1]).toHaveTextContent("−₹400.00");
    expect(rows[1]).toHaveTextContent("₹600.00");
    expect(rows[2]).toHaveTextContent("+₹1,000.00");
  });

  it("tops up with an Idempotency-Key and reuses the key when a failed attempt is retried", async () => {
    vi.mocked(api.topUp)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        topup_id: 9,
        amount: "500.00",
        balance: "1100.00",
        status: "COMPLETED",
        replayed: false,
      });
    setup();
    await screen.findByText("₹600.00", { selector: "strong" });

    await userEvent.click(screen.getByRole("button", { name: "Add money" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Add money" }));

    await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(api.topUp).mock.calls;
    expect(first[0]).toBe("500");
    expect(second[1]).toBe(first[1]);
    expect(await screen.findByRole("status")).toHaveTextContent("Added ₹500.00");
  });

  it("blocks an invalid amount", async () => {
    setup();
    await screen.findByText("₹600.00", { selector: "strong" });

    await userEvent.clear(screen.getByLabelText("Amount (₹)"));
    await userEvent.type(screen.getByLabelText("Amount (₹)"), "12.345");

    expect(screen.getByRole("button", { name: "Add money" })).toBeDisabled();
    expect(api.topUp).not.toHaveBeenCalled();
  });
});
