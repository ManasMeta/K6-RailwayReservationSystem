import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelRun,
  fetchRunChart,
  fetchTrainRuns,
  prepareRunChart,
  updateRunDelay,
} from "./api";
import { OperationsPage } from "./OperationsPage";
import type { TrainRun } from "./types";

vi.mock("./api", () => ({
  apiErrorCode: (error: { response?: { data?: { code?: string } } }) => error.response?.data?.code,
  cancelRun: vi.fn(),
  fetchBusiestSegments: vi.fn(),
  fetchOccupancyByClass: vi.fn(),
  fetchRevenueByDay: vi.fn(),
  fetchRunChart: vi.fn(),
  fetchTrainRuns: vi.fn(),
  fetchWaitingListConversion: vi.fn(),
  prepareRunChart: vi.fn(),
  refreshReports: vi.fn(),
  updateRunDelay: vi.fn(),
}));

const runsMock = vi.mocked(fetchTrainRuns);
const delayMock = vi.mocked(updateRunDelay);
const cancelMock = vi.mocked(cancelRun);
const prepareMock = vi.mocked(prepareRunChart);
const chartMock = vi.mocked(fetchRunChart);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OperationsPage />
    </QueryClientProvider>,
  );
}

const scheduledRun: TrainRun = {
  run_id: 10,
  train_no: "12301",
  train_name: "Howrah Rajdhani",
  run_date: "2026-10-25",
  status: "SCHEDULED",
  delay_minutes: 0,
  chart_prepared: false,
};
const delayedRun: TrainRun = { ...scheduledRun, run_id: 11, status: "DELAYED", delay_minutes: 45 };
const departedRun: TrainRun = { ...scheduledRun, run_id: 12, status: "DEPARTED" };
const cancelledRun: TrainRun = { ...scheduledRun, run_id: 13, status: "CANCELLED" };

describe("OperationsPage", () => {
  beforeEach(() => {
    runsMock.mockReset();
    delayMock.mockReset();
    cancelMock.mockReset();
    prepareMock.mockReset();
    chartMock.mockReset();
    runsMock.mockResolvedValue([scheduledRun]);
  });

  it("uses live API mode by default and shows only the supported statuses", async () => {
    runsMock.mockResolvedValue([scheduledRun, delayedRun, departedRun, cancelledRun]);
    renderPage();

    expect(screen.getByText(/live api mode/i)).toBeInTheDocument();
    expect(await screen.findAllByText("Howrah Rajdhani")).toHaveLength(4);
    expect(screen.getByText("scheduled")).toBeInTheDocument();
    expect(screen.getByText("delayed")).toBeInTheDocument();
    expect(runsMock).toHaveBeenCalledWith(undefined);
  });

  it("filters runs by selected run date", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Run date"), { target: { value: "2026-10-25" } });

    await waitFor(() => expect(runsMock).toHaveBeenLastCalledWith("2026-10-25"));
    expect(await screen.findByText("Howrah Rajdhani")).toBeInTheDocument();
  });

  it("updates delay with nullable station and notes fields", async () => {
    const user = userEvent.setup();
    delayMock.mockResolvedValue({ ...scheduledRun, status: "DELAYED", delay_minutes: 35 });
    renderPage();
    await screen.findByText("Howrah Rajdhani");

    await user.click(screen.getByRole("button", { name: "Delay" }));
    await user.clear(screen.getByLabelText("Total delay (minutes)"));
    await user.type(screen.getByLabelText("Total delay (minutes)"), "35");
    await user.type(screen.getByLabelText("Station code (optional)"), "NDLS");
    await user.type(screen.getByLabelText("Notes (optional)"), "Signal check");
    await user.click(screen.getByRole("button", { name: "Save delay" }));

    await waitFor(() => expect(delayMock).toHaveBeenCalledWith(10, {
      delay_minutes: 35,
      station_code: "NDLS",
      notes: "Signal check",
    }));
    expect(await screen.findByText("Delay update saved.")).toBeInTheDocument();
  });

  it("shows a friendly RUN_NOT_ACTIVE error from a staff action", async () => {
    const user = userEvent.setup();
    delayMock.mockRejectedValue({ response: { data: { code: "RUN_NOT_ACTIVE" } } });
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "Delay" }));
    await user.click(screen.getByRole("button", { name: "Save delay" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This run is no longer active");
  });

  it("requires explicit confirmation before cancelling the run", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({
      run_id: 10,
      status: "CANCELLED",
      passengers_cancelled: 2,
      total_refunded: 2400,
    });
    renderPage();
    await screen.findByText("Howrah Rajdhani");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this train run?" });
    expect(within(dialog).getByText(/every passenger and initiate a full refund/i)).toBeInTheDocument();
    expect(cancelMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(10, undefined));
    expect(await within(dialog).findByText(/Cancellation recorded/)).toBeInTheDocument();
  });

  it("shows friendly cancellation errors and leaves the destructive dialog available", async () => {
    const user = userEvent.setup();
    cancelMock.mockRejectedValue({ response: { data: { code: "RUN_ALREADY_CANCELLED" } } });
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already been cancelled");
  });

  it("disables unsafe actions for cancelled and departed runs", async () => {
    runsMock.mockResolvedValue([departedRun, cancelledRun]);
    renderPage();
    await screen.findAllByText("Howrah Rajdhani");

    expect(screen.getAllByRole("button", { name: "Delay" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Cancel" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Prepare chart" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("prepares a chart and displays the preparation result", async () => {
    const user = userEvent.setup();
    prepareMock.mockResolvedValue({
      run_id: 10,
      chart_id: 22,
      promoted: 4,
      remaining_rac: 1,
      remaining_wl: 2,
      final_vacant_berths: 6,
      already_prepared: false,
    });
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "Prepare chart" }));

    expect(await screen.findByText(/4 promoted; 1 RAC and 2 WL remain/)).toBeInTheDocument();
  });

  it("groups prepared chart entries by coach", async () => {
    const user = userEvent.setup();
    runsMock.mockResolvedValue([{ ...scheduledRun, chart_prepared: true }]);
    chartMock.mockResolvedValue({
      chart_id: 22,
      run_id: 10,
      prepared_at: "2026-10-25T07:00:00Z",
      final_vacant_berths: 1,
      entries: [
        { passenger_id: 1, pnr: "1000000000", name: "A**** K****", status: "CNF", coach_code: "A1", berth_no: 18, berth_type: "LOWER", quota_code: "GN" },
        { passenger_id: 2, pnr: "1000000001", name: "R**** S****", status: "RAC", coach_code: "A1", berth_no: null, berth_type: null, quota_code: "GN" },
      ],
    });
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "View chart" }));

    expect(await screen.findByRole("heading", { name: "A1" })).toBeInTheDocument();
    expect(screen.getByText("A**** K****")).toBeInTheDocument();
    expect(chartMock).toHaveBeenCalledWith(10);
  });

  it("shows the specific not-prepared chart error", async () => {
    const user = userEvent.setup();
    runsMock.mockResolvedValue([{ ...scheduledRun, chart_prepared: true }]);
    chartMock.mockRejectedValue({ response: { data: { code: "CHART_NOT_PREPARED" } } });
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "View chart" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A chart has not been prepared");
  });

  it("keeps demo runs separate from live requests and marks staff actions unavailable", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Howrah Rajdhani");
    await user.click(screen.getByRole("button", { name: "Demo preview" }));

    expect(screen.getByText(/not live runs, passenger records, or database results/i)).toBeInTheDocument();
    expect(runsMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Cancel" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
