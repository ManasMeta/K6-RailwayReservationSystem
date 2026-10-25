import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPNR } from "./api";
import { PNRStatusPage } from "./PNRStatusPage";
import type { PNRResponse } from "./types";

vi.mock("./api", () => ({
  apiErrorCode: (error: { response?: { data?: { code?: string } } }) => error.response?.data?.code,
  fetchPNR: vi.fn(),
}));

const pnrMock = vi.mocked(fetchPNR);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PNRStatusPage />
    </QueryClientProvider>,
  );
}

const pnrResponse: PNRResponse = {
  pnr: "1234567890",
  reservation_status: "CONFIRMED",
  train_no: "12301",
  train_name: "Howrah Rajdhani",
  run_date: "2026-10-25",
  from_station_code: "NDLS",
  from_station_name: "New Delhi",
  to_station_code: "HWH",
  to_station_name: "Howrah Junction",
  class_code: "2A",
  quota_code: "GN",
  run_status: "DELAYED",
  delay_minutes: 25,
  chart_prepared: true,
  passengers: [
    { name: "A**** K****", status: "CNF", coach_code: "A1", berth_no: 18, berth_type: "LOWER", rac_number: null, wl_number: null },
  ],
};

describe("PNRStatusPage", () => {
  beforeEach(() => pnrMock.mockReset());

  it("validates exactly 10 digits before calling the PNR API", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("10-digit PNR number"), "123456789");
    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(screen.getByText("PNR must contain exactly 10 digits.")).toBeInTheDocument();
    expect(pnrMock).not.toHaveBeenCalled();
  });

  it("loads reservation details and masked passenger statuses for a valid PNR", async () => {
    const user = userEvent.setup();
    pnrMock.mockResolvedValue(pnrResponse);
    renderPage();
    await user.type(screen.getByLabelText("10-digit PNR number"), pnrResponse.pnr);
    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByRole("heading", { name: /Howrah Rajdhani/ })).toBeInTheDocument();
    expect(screen.getByText("A**** K****")).toBeInTheDocument();
    expect(screen.getByText("CNF")).toBeInTheDocument();
    expect(pnrMock).toHaveBeenCalledWith("1234567890");
  });

  it("handles INVALID_PNR and PNR_NOT_FOUND errors", async () => {
    const user = userEvent.setup();
    pnrMock.mockRejectedValueOnce({ response: { data: { code: "INVALID_PNR" } } });
    renderPage();
    await user.type(screen.getByLabelText("10-digit PNR number"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid 10-digit PNR");

    pnrMock.mockRejectedValueOnce({ response: { data: { code: "PNR_NOT_FOUND" } } });
    await user.clear(screen.getByLabelText("10-digit PNR number"));
    await user.type(screen.getByLabelText("10-digit PNR number"), "0987654321");
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No reservation was found");
  });

  it("shows the isolated demo PNR without making a live request", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Demo preview" }));
    expect(screen.getByText(/sample passenger details, not a live reservation/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("10-digit PNR number"), "1000000000");
    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByRole("heading", { name: /Bhopal Shatabdi/ })).toBeInTheDocument();
    expect(pnrMock).not.toHaveBeenCalled();
  });

  it("does not call the live API for non-numeric input", async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.change(screen.getByLabelText("10-digit PNR number"), { target: { value: "1234abc890" } });
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(pnrMock).not.toHaveBeenCalled();
  });
});
