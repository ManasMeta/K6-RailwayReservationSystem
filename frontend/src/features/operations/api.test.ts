import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import {
  cancelRun,
  fetchBusiestSegments,
  fetchOccupancyByClass,
  fetchPNR,
  fetchRevenueByDay,
  fetchRunChart,
  fetchTrainRuns,
  fetchWaitingListConversion,
  prepareRunChart,
  refreshReports,
  updateRunDelay,
} from "./api";

vi.mock("../../api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);

describe("operations API wrappers", () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: [] } as never);
    postMock.mockReset().mockResolvedValue({ data: {} } as never);
  });

  it("requests train runs with the selected date and fixed page parameters", async () => {
    await fetchTrainRuns("2026-10-25");
    expect(getMock).toHaveBeenCalledWith("/ops/runs", {
      params: { run_date: "2026-10-25", page: 1, page_size: 50 },
    });
  });

  it("posts delay, cancellation, and chart-preparation requests to the specified routes", async () => {
    const delay = { delay_minutes: 30, station_code: "NDLS", notes: "Signal check" };
    await updateRunDelay(42, delay);
    await cancelRun(42, "Service disruption");
    await cancelRun(43);
    await prepareRunChart(42);

    expect(postMock).toHaveBeenNthCalledWith(1, "/ops/runs/42/delay", delay);
    expect(postMock).toHaveBeenNthCalledWith(2, "/ops/runs/42/cancel", { reason: "Service disruption" });
    expect(postMock).toHaveBeenNthCalledWith(3, "/ops/runs/43/cancel", undefined);
    expect(postMock).toHaveBeenNthCalledWith(4, "/ops/runs/42/chart");
  });

  it("uses the specified PNR, chart, and reports endpoints", async () => {
    await fetchRunChart(42);
    await fetchPNR("1000000000");
    await fetchRevenueByDay({ from: "2026-10-01", to: "2026-10-31" });
    await fetchOccupancyByClass({});
    await fetchWaitingListConversion({});
    await fetchBusiestSegments({});
    await refreshReports();

    expect(getMock).toHaveBeenNthCalledWith(1, "/ops/runs/42/chart");
    expect(getMock).toHaveBeenNthCalledWith(2, "/pnr/1000000000");
    expect(getMock).toHaveBeenNthCalledWith(3, "/reports/revenue", {
      params: { by: "day", from: "2026-10-01", to: "2026-10-31" },
    });
    expect(getMock).toHaveBeenNthCalledWith(4, "/reports/occupancy", {
      params: { by: "class", from: undefined, to: undefined },
    });
    expect(getMock).toHaveBeenNthCalledWith(5, "/reports/wl-conversion", {
      params: { from: undefined, to: undefined },
    });
    expect(getMock).toHaveBeenNthCalledWith(6, "/reports/busiest-segments", {
      params: { limit: 10, from: undefined, to: undefined },
    });
    expect(postMock).toHaveBeenCalledWith("/reports/refresh");
  });
});
