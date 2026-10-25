import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainRun } from "./api";
import { OperationsPage } from "./OperationsPage";
import { fetchTrainRuns } from "./api";

vi.mock("./api", () => ({ fetchTrainRuns: vi.fn() }));

const fetchRunsMock = vi.mocked(fetchTrainRuns);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OperationsPage />
    </QueryClientProvider>,
  );
}

const liveRun: TrainRun = {
  run_id: 10,
  train_no: "12301",
  train_name: "Howrah Rajdhani",
  run_date: "2026-10-25",
  status: "RUNNING",
  delay_minutes: 45,
  chart_prepared: false,
};

describe("OperationsPage", () => {
  beforeEach(() => {
    fetchRunsMock.mockReset();
  });

  it("shows clearly labeled preview data without calling the API", () => {
    renderPage();

    expect(screen.getByText(/sample records for interface preview only/i)).toBeInTheDocument();
    expect(screen.getByText("Bhopal Shatabdi")).toBeInTheDocument();
    expect(fetchRunsMock).not.toHaveBeenCalled();
  });

  it("filters preview records by date", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Run date"), {
      target: { value: "2026-10-26" },
    });

    expect(screen.getByText("Tamil Nadu Express")).toBeInTheDocument();
    expect(screen.queryByText("Bhopal Shatabdi")).not.toBeInTheDocument();
    expect(fetchRunsMock).not.toHaveBeenCalled();
  });

  it("uses the live API wrapper with the selected date", async () => {
    const user = userEvent.setup();
    fetchRunsMock.mockResolvedValue([liveRun]);
    renderPage();

    fireEvent.change(screen.getByLabelText("Run date"), {
      target: { value: "2026-10-25" },
    });
    await user.click(screen.getByRole("button", { name: "Live API" }));

    await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledWith("2026-10-25"));
    expect(await screen.findByText("Howrah Rajdhani")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("offers retry when the live API request fails", async () => {
    const user = userEvent.setup();
    fetchRunsMock.mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce([liveRun]);
    renderPage();
    await user.click(screen.getByRole("button", { name: "Live API" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load train runs");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Howrah Rajdhani")).toBeInTheDocument();
    expect(fetchRunsMock).toHaveBeenCalledTimes(2);
  });
});
