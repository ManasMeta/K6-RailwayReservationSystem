import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { PayReservationPage } from "./PayReservationPage";

vi.mock("./api");

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/reservations/1000000001/pay"]}>
        <Routes>
          <Route path="/reservations/:pnr/pay" element={<PayReservationPage />} />
          <Route path="/tickets/:pnr" element={<p>ticket page</p>} />
          <Route path="/wallet" element={<p>wallet page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const quote = {
  pnr: "1000000001",
  amount: "400.00",
  status: "PENDING_PAYMENT",
  balance: "1000.00",
  payable: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.errorCode).mockImplementation(
    (error) => (error as { code?: string } | undefined)?.code,
  );
});

describe("PayReservationPage", () => {
  it("shows the fare and the balance after payment, then opens the e-ticket", async () => {
    vi.mocked(api.getQuote).mockResolvedValue(quote);
    vi.mocked(api.payReservation).mockResolvedValue({
      payment_id: 1,
      pnr: quote.pnr,
      amount: "400.00",
      balance: "600.00",
      ticket_number: "YTR-1000000001",
      replayed: false,
    });
    setup();

    expect(await screen.findByText("₹600.00")).toBeInTheDocument(); // balance after payment
    await userEvent.click(screen.getByRole("button", { name: "Pay ₹400.00 from wallet" }));

    expect(await screen.findByText("ticket page")).toBeInTheDocument();
    expect(api.payReservation).toHaveBeenCalledWith("1000000001", expect.any(String));
  });

  it("disables payment and links to the wallet when the balance is too low", async () => {
    vi.mocked(api.getQuote).mockResolvedValue({ ...quote, balance: "100.00" });
    setup();

    const button = await screen.findByRole("button", { name: /Pay ₹400.00/ });

    expect(button).toBeDisabled();
    expect(screen.getByRole("link", { name: "Add money" })).toHaveAttribute("href", "/wallet");
  });

  it("does not offer payment for a reservation that is already confirmed", async () => {
    vi.mocked(api.getQuote).mockResolvedValue({ ...quote, status: "CONFIRMED", payable: false });
    setup();

    expect(await screen.findByText(/cannot be paid/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "View e-ticket" })).toBeInTheDocument();
  });
});
