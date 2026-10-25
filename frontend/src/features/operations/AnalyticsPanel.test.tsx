import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBusiestSegments,
  fetchOccupancyByClass,
  fetchRevenueByDay,
  fetchWaitingListConversion,
  refreshReports,
} from "./api";
import { AnalyticsPanel } from "./AnalyticsPanel";

vi.mock("./api", () => ({
  fetchBusiestSegments: vi.fn(),
  fetchOccupancyByClass: vi.fn(),
  fetchRevenueByDay: vi.fn(),
  fetchWaitingListConversion: vi.fn(),
  refreshReports: vi.fn(),
}));

const revenueMock = vi.mocked(fetchRevenueByDay);
const occupancyMock = vi.mocked(fetchOccupancyByClass);
const waitingMock = vi.mocked(fetchWaitingListConversion);
const segmentsMock = vi.mocked(fetchBusiestSegments);
const refreshMock = vi.mocked(refreshReports);

function renderPanel(demo = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsPanel demo={demo} />
    </QueryClientProvider>,
  );
}

describe("AnalyticsPanel", () => {
  beforeEach(() => {
    revenueMock.mockReset().mockResolvedValue([
      { day: "2026-10-25", class_code: "2A", bookings: 10, gross: 1000, refunded: 100, net: 900 },
    ]);
    occupancyMock.mockReset().mockResolvedValue([
      { class_code: "2A", total_berths: 100, booked_berths: 80, occupancy_pct: 80 },
    ]);
    waitingMock.mockReset().mockResolvedValue({ waiting: 20, promoted: 15, conversion_pct: 75 });
    segmentsMock.mockReset().mockResolvedValue([
      { train_no: "12301", train_name: "Rajdhani", from_station_code: "NDLS", from_station_name: "New Delhi", to_station_code: "HWH", to_station_name: "Howrah", passengers: 100 },
    ]);
    refreshMock.mockReset().mockResolvedValue(undefined);
  });

  it("shows the requested report charts and the waiting-list conversion percentage", async () => {
    renderPanel();

    expect(await screen.findByText("75.0%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revenue by day" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Occupancy by class" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Busiest segments" })).toBeInTheDocument();
    expect(segmentsMock).toHaveBeenCalledWith({ from: undefined, to: undefined });
  });

  it("renders a dash when conversion is null", async () => {
    waitingMock.mockResolvedValue({ waiting: 0, promoted: 0, conversion_pct: null });
    renderPanel();

    expect(await screen.findByText("No waiting-list passengers in this period.")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("passes optional date filters to each report request", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-31" } });

    await waitFor(() => {
      expect(revenueMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31" });
      expect(occupancyMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31" });
      expect(waitingMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31" });
      expect(segmentsMock).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-31" });
    });
  });

  it("refreshes live reports and reloads report queries", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /refresh data/i }));
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Refresh request completed (HTTP 2xx)");
  });

  it("does not make report or refresh API calls in demo mode", async () => {
    renderPanel(true);
    expect(screen.getByText(/not live reports/i)).toBeInTheDocument();
    expect(screen.getByText("60.5%")).toBeInTheDocument();
    expect(revenueMock).not.toHaveBeenCalled();
    expect(occupancyMock).not.toHaveBeenCalled();
    expect(waitingMock).not.toHaveBeenCalled();
    expect(segmentsMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /refresh data/i })).toBeDisabled();
  });
});
