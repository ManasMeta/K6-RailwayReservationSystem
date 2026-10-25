import { api } from "../../api/client";
import type {
  BusiestSegment,
  CancelRunResponse,
  OccupancyByClassRow,
  PNRResponse,
  PrepareChartResponse,
  PreparedChartResponse,
  RevenueByDayRow,
  TrainRun,
  UpdateDelayRequest,
  UpdateDelayResponse,
  WaitingListConversionResponse,
} from "./types";

export type {
  BusiestSegment,
  CancelRunResponse,
  ChartEntry,
  ChartPassengerStatus,
  OccupancyByClassRow,
  PNRPassenger,
  PNRResponse,
  PassengerReservationStatus,
  PrepareChartResponse,
  PreparedChartResponse,
  RevenueByDayRow,
  RunStatus,
  TrainRun,
  UpdateDelayRequest,
  UpdateDelayResponse,
  WaitingListConversionResponse,
} from "./types";

export async function fetchTrainRuns(runDate?: string): Promise<TrainRun[]> {
  const { data } = await api.get<TrainRun[]>("/ops/runs", {
    params: { run_date: runDate, page: 1, page_size: 50 },
  });
  return data;
}

export async function updateRunDelay(
  runId: number,
  request: UpdateDelayRequest,
): Promise<UpdateDelayResponse> {
  const { data } = await api.post<UpdateDelayResponse>(`/ops/runs/${runId}/delay`, request);
  return data;
}

export async function cancelRun(runId: number, reason?: string): Promise<CancelRunResponse> {
  const { data } = await api.post<CancelRunResponse>(
    `/ops/runs/${runId}/cancel`,
    reason ? { reason } : undefined,
  );
  return data;
}

export async function prepareRunChart(runId: number): Promise<PrepareChartResponse> {
  const { data } = await api.post<PrepareChartResponse>(`/ops/runs/${runId}/chart`);
  return data;
}

export async function fetchRunChart(runId: number): Promise<PreparedChartResponse> {
  const { data } = await api.get<PreparedChartResponse>(`/ops/runs/${runId}/chart`);
  return data;
}

export async function fetchPNR(pnr: string): Promise<PNRResponse> {
  const { data } = await api.get<PNRResponse>(`/pnr/${pnr}`);
  return data;
}

export interface ReportFilters {
  from?: string;
  to?: string;
}

export async function fetchRevenueByDay(filters: ReportFilters): Promise<RevenueByDayRow[]> {
  const { data } = await api.get<RevenueByDayRow[]>("/reports/revenue", {
    params: { by: "day", ...filters },
  });
  return data;
}

export async function fetchOccupancyByClass(filters: ReportFilters): Promise<OccupancyByClassRow[]> {
  const { data } = await api.get<OccupancyByClassRow[]>("/reports/occupancy", {
    params: { by: "class", ...filters },
  });
  return data;
}

export async function fetchWaitingListConversion(
  filters: ReportFilters,
): Promise<WaitingListConversionResponse> {
  const { data } = await api.get<WaitingListConversionResponse>("/reports/wl-conversion", {
    params: filters,
  });
  return data;
}

export async function fetchBusiestSegments(filters: ReportFilters): Promise<BusiestSegment[]> {
  const { data } = await api.get<BusiestSegment[]>("/reports/busiest-segments", {
    params: { limit: 10, ...filters },
  });
  return data;
}

export async function refreshReports(): Promise<void> {
  await api.post("/reports/refresh");
}

export function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) return undefined;
  const response = error.response;
  if (typeof response !== "object" || response === null || !("data" in response)) return undefined;
  const data = response.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? data.code : undefined;
}
