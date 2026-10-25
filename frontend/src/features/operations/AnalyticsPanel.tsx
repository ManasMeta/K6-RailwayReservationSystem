import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { errorMessage } from "../../api/client";
import {
  fetchBusiestSegments,
  fetchOccupancyByClass,
  fetchRevenueByDay,
  fetchWaitingListConversion,
  refreshReports,
} from "./api";
import {
  demoOccupancy,
  demoRevenue,
  demoSegments,
  demoWaitingList,
} from "./demoData";
import type {
  BusiestSegment,
  OccupancyByClassRow,
  RevenueByDayRow,
  WaitingListConversionResponse,
} from "./types";

interface AnalyticsPanelProps {
  demo: boolean;
}

const chartColors = ["#3d6ed4", "#e28b3b", "#39a176", "#8a6cc7", "#d25f57"];
const EMPTY_REVENUE: RevenueByDayRow[] = [];
const EMPTY_SEGMENTS: BusiestSegment[] = [];

function ReportError({ error }: { error: unknown }) {
  return <p className="ops-report-error" role="alert">{errorMessage(error)}</p>;
}

export function AnalyticsPanel({ demo }: AnalyticsPanelProps) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filters = { from: from || undefined, to: to || undefined };
  const revenueQuery = useQuery({
    queryKey: ["ops", "report", "revenue", filters],
    queryFn: () => fetchRevenueByDay(filters),
    enabled: !demo,
  });
  const occupancyQuery = useQuery({
    queryKey: ["ops", "report", "occupancy", filters],
    queryFn: () => fetchOccupancyByClass(filters),
    enabled: !demo,
  });
  const waitingQuery = useQuery({
    queryKey: ["ops", "report", "wl-conversion", filters],
    queryFn: () => fetchWaitingListConversion(filters),
    enabled: !demo,
  });
  const segmentsQuery = useQuery({
    queryKey: ["ops", "report", "busiest-segments", filters],
    queryFn: () => fetchBusiestSegments(filters),
    enabled: !demo,
  });
  const refreshMutation = useMutation({
    mutationFn: refreshReports,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ops", "report"] });
    },
  });

  const revenueRows = demo ? demoRevenue : revenueQuery.data ?? EMPTY_REVENUE;
  const occupancyRows = demo ? demoOccupancy : occupancyQuery.data ?? [];
  const waitingList: WaitingListConversionResponse | undefined = demo
    ? demoWaitingList
    : waitingQuery.data;
  const segmentRows: BusiestSegment[] = demo ? demoSegments : segmentsQuery.data ?? EMPTY_SEGMENTS;
  const revenue = useMemo(() => {
    const byDay = new Map<string, number>();
    const filteredRows = revenueRows.filter((row) =>
      (!from || row.day >= from) && (!to || row.day <= to));
    filteredRows.forEach((row) => {
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.net);
    });
    return [...byDay].map(([day, net]) => ({ day, net }));
  }, [from, revenueRows, to]);
  const segments = useMemo(
    () => segmentRows.map((segment) => ({
        ...segment,
        route: `${segment.from_station_name} → ${segment.to_station_name}`,
      })),
    [segmentRows],
  );
  const reports = [
    { title: "Revenue by day", query: revenueQuery, isEmpty: revenue.length === 0 },
    { title: "Occupancy by class", query: occupancyQuery, isEmpty: occupancyRows.length === 0 },
    { title: "Waiting-list conversion", query: waitingQuery, isEmpty: waitingList === undefined },
    { title: "Busiest segments", query: segmentsQuery, isEmpty: segments.length === 0 },
  ];
  const pending = !demo && reports.some(({ query }) => query.isLoading);

  return (
    <section className="ops-analytics">
      <div className="ops-analytics-heading">
        <div>
          <h2>Network analytics</h2>
          <p>Revenue, seat occupancy, waiting-list conversion, and busiest routes.</p>
        </div>
        <button
          type="button"
          className="ops-refresh-button"
          disabled={demo || refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
          title={demo ? "Refresh is available in Live API mode" : undefined}
        >
          {refreshMutation.isPending ? "Refreshing…" : "↻ Refresh data"}
        </button>
      </div>

      {demo && <p className="ops-demo-note">All charts below use labeled demo preview data, not live reports. Date filters update live requests; reports without dated sample rows remain illustrative.</p>}
      {!demo && pending && <p className="ops-loading" role="status">Loading reports…</p>}
      {!demo && refreshMutation.isSuccess && (
        <p className="ops-success" role="status">Refresh request completed (HTTP 2xx).</p>
      )}
      {!demo && refreshMutation.error && <ReportError error={refreshMutation.error} />}

      <div className="ops-report-filters">
        <div className="field"><label htmlFor="ops-report-from">From date</label><input id="ops-report-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></div>
        <div className="field"><label htmlFor="ops-report-to">To date</label><input id="ops-report-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></div>
        {(from || to) && <button type="button" className="ops-clear-filter" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</button>}
      </div>

      <div className="ops-report-grid">
        <article className="ops-report-card ops-report-card--wide">
          <div className="ops-report-title"><h3>Revenue by day</h3><span>Net revenue · ₹</span></div>
          {!demo && revenueQuery.error ? <ReportError error={revenueQuery.error} /> : null}
          {!demo && revenueQuery.isLoading ? <p className="ops-chart-state">Loading revenue…</p> : null}
          {!demo && !revenueQuery.isLoading && !revenueQuery.error && revenue.length === 0
            ? <p className="ops-chart-state">No revenue data for this period.</p> : null}
          {(demo || (!revenueQuery.isLoading && !revenueQuery.error && revenue.length > 0)) && (
            <div className="ops-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e9edf3" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#78869c" }} tickFormatter={(day: string) => day.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "#78869c" }} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} width={48} />
                  <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Net revenue"]} labelFormatter={(day) => `Date: ${day}`} />
                  <Bar dataKey="net" fill="#3d6ed4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="ops-report-card">
          <div className="ops-report-title"><h3>Occupancy by class</h3><span>Booked berths</span></div>
          {!demo && occupancyQuery.error ? <ReportError error={occupancyQuery.error} /> : null}
          {!demo && occupancyQuery.isLoading ? <p className="ops-chart-state">Loading occupancy…</p> : null}
          {!demo && !occupancyQuery.isLoading && !occupancyQuery.error && occupancyRows.length === 0
            ? <p className="ops-chart-state">No occupancy data for this period.</p> : null}
          {(demo || (!occupancyQuery.isLoading && !occupancyQuery.error && occupancyRows.length > 0)) && (
            <div className="ops-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyRows} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#e9edf3" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="class_code" tick={{ fontSize: 10, fill: "#78869c" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#78869c" }} tickFormatter={(value: number) => `${value}%`} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Occupancy"]} />
                  <Bar dataKey="occupancy_pct" radius={[4, 4, 0, 0]}>
                    {occupancyRows.map((row: OccupancyByClassRow, index) => (
                      <Cell key={row.class_code} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="ops-report-card ops-conversion-card">
          <div className="ops-report-title"><h3>Waiting-list conversion</h3><span>Promoted / waiting</span></div>
          {!demo && waitingQuery.error ? <ReportError error={waitingQuery.error} /> : null}
          {!demo && waitingQuery.isLoading ? <p className="ops-chart-state">Loading conversion…</p> : null}
          {waitingList && (
            <>
              <strong className="ops-conversion-value">
                {waitingList.conversion_pct === null
                  ? "—"
                  : `${waitingList.conversion_pct.toFixed(1)}%`}
              </strong>
              <p className="ops-conversion-caption">
                {waitingList.conversion_pct === null
                  ? "No waiting-list passengers in this period."
                  : `${waitingList.promoted.toLocaleString()} of ${waitingList.waiting.toLocaleString()} passengers promoted`}
              </p>
            </>
          )}
          {!demo && !waitingQuery.isLoading && !waitingQuery.error && !waitingList && (
            <p className="ops-chart-state">No conversion data for this period.</p>
          )}
        </article>

        <article className="ops-report-card ops-report-card--wide">
          <div className="ops-report-title"><h3>Busiest segments</h3><span>Top 10 by passengers</span></div>
          {!demo && segmentsQuery.error ? <ReportError error={segmentsQuery.error} /> : null}
          {!demo && segmentsQuery.isLoading ? <p className="ops-chart-state">Loading busiest segments…</p> : null}
          {!demo && !segmentsQuery.isLoading && !segmentsQuery.error && segments.length === 0
            ? <p className="ops-chart-state">No segment data for this period.</p> : null}
          {(demo || (!segmentsQuery.isLoading && !segmentsQuery.error && segments.length > 0)) && (
            <div className="ops-segment-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segments} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 4 }}>
                  <CartesianGrid stroke="#e9edf3" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#78869c" }} />
                  <YAxis type="category" dataKey="route" width={170} tick={{ fontSize: 10, fill: "#59677d" }} />
                  <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Passengers"]} />
                  <Bar dataKey="passengers" fill="#e28b3b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
