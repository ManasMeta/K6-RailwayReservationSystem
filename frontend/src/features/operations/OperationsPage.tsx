import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { errorMessage } from "../../api/client";
import { useSession } from "../accounts/session";
import {
  apiErrorCode,
  cancelRun,
  fetchRunChart,
  fetchTrainRuns,
  prepareRunChart,
  updateRunDelay,
} from "./api";
import { demoChart, demoTrainRuns } from "./demoData";
import type { PreparedChartResponse, TrainRun, UpdateDelayRequest } from "./types";
import "./operations.css";

type DataMode = "live" | "demo";
type DashboardTab = "runs" | "analytics";
type Dialog =
  | { type: "delay"; run: TrainRun }
  | { type: "cancel"; run: TrainRun }
  | { type: "chart"; run: TrainRun }
  | null;

const AnalyticsPanel = lazy(() =>
  import("./AnalyticsPanel").then((module) => ({ default: module.AnalyticsPanel })),
);

const ACTIVE_STATUSES = new Set(["SCHEDULED", "DELAYED"]);

function statusClass(status: string): string {
  return `ops-status ops-status--${status.toLowerCase()}`;
}

function friendlyActionError(error: unknown): string {
  const code = apiErrorCode(error);
  if (code === "RUN_ALREADY_CANCELLED") return "This train run has already been cancelled.";
  if (code === "RUN_NOT_ACTIVE") return "This run is no longer active, so this action is unavailable.";
  if (code === "CHART_NOT_PREPARED") return "A chart has not been prepared for this run yet.";
  return errorMessage(error);
}

function ChartContents({ chart }: { chart: PreparedChartResponse }) {
  const coaches = new Map<string, typeof chart.entries>();
  chart.entries.forEach((entry) => {
    const coach = entry.coach_code ?? "Unassigned";
    coaches.set(coach, [...(coaches.get(coach) ?? []), entry]);
  });
  return (
    <div className="ops-coaches">
      <p className="ops-chart-summary">
        Chart #{chart.chart_id} · {chart.entries.length} passengers · {chart.final_vacant_berths} vacant berths
      </p>
      {[...coaches].map(([coach, entries]) => (
        <section className="ops-coach" key={coach}>
          <h3>{coach}</h3>
          <div className="ops-coach-table-wrap">
            <table className="ops-table ops-coach-table">
              <thead><tr><th scope="col">Passenger</th><th scope="col">PNR</th><th scope="col">Status</th><th scope="col">Berth</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.passenger_id}>
                    <th scope="row">{entry.name}</th>
                    <td>{entry.pnr}</td>
                    <td>{entry.status}</td>
                    <td>{entry.berth_no === null ? "—" : `${entry.berth_no}${entry.berth_type ? ` · ${entry.berth_type}` : ""}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export function OperationsPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  // Staff run the board; the admin reports are admin-only on the API, so hide the tab from staff.
  const showAnalytics = session?.role !== "staff";
  const [mode, setMode] = useState<DataMode>("live");
  const [tab, setTab] = useState<DashboardTab>("runs");
  const [runDate, setRunDate] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [delayMinutes, setDelayMinutes] = useState("");
  const [stationCode, setStationCode] = useState("");
  const [delayNotes, setDelayNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["ops", "runs", runDate],
    queryFn: () => fetchTrainRuns(runDate || undefined),
    enabled: mode === "live" && tab === "runs",
  });
  const displayedRuns = mode === "demo"
    ? demoTrainRuns.filter((run) => !runDate || run.run_date === runDate)
    : runsQuery.data ?? [];
  const runs = displayedRuns;
  const selectedChartQuery = useQuery({
    queryKey: ["ops", "chart", dialog?.type === "chart" ? dialog.run.run_id : null],
    queryFn: () => {
      if (dialog?.type !== "chart") throw new Error("No train run selected for chart lookup.");
      return fetchRunChart(dialog.run.run_id);
    },
    enabled: mode === "live" && dialog?.type === "chart",
  });
  const delayMutation = useMutation({
    mutationFn: ({ run, payload }: { run: TrainRun; payload: UpdateDelayRequest }) =>
      updateRunDelay(run.run_id, payload),
    onSuccess: async () => {
      setActionMessage("Delay update saved.");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["ops", "runs"] });
      setDialog(null);
    },
    onError: (error) => setActionError(friendlyActionError(error)),
  });
  const cancelMutation = useMutation({
    mutationFn: ({ run, reason }: { run: TrainRun; reason: string }) =>
      cancelRun(run.run_id, reason || undefined),
    onSuccess: async (result) => {
      setActionMessage(
        `Run cancelled. ${result.passengers_cancelled} passengers cancelled; total refund ₹${result.total_refunded.toLocaleString("en-IN")}.`,
      );
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["ops", "runs"] });
    },
    onError: (error) => setActionError(friendlyActionError(error)),
  });
  const prepareMutation = useMutation({
    mutationFn: (run: TrainRun) => prepareRunChart(run.run_id),
    onSuccess: async (result) => {
      setActionMessage(
        `Chart ${result.already_prepared ? "was already prepared" : "prepared"}. ${result.promoted} promoted; ${result.remaining_rac} RAC and ${result.remaining_wl} WL remain; ${result.final_vacant_berths} berths vacant.`,
      );
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["ops", "runs"] });
      await queryClient.invalidateQueries({ queryKey: ["ops", "chart", result.run_id] });
    },
    onError: (error) => setActionError(friendlyActionError(error)),
  });

  function openDelay(run: TrainRun) {
    setDelayMinutes(String(run.delay_minutes));
    setStationCode("");
    setDelayNotes("");
    setActionMessage(null);
    setActionError(null);
    setDialog({ type: "delay", run });
  }

  function submitDelay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.type !== "delay") return;
    const parsedDelay = Number(delayMinutes);
    if (!Number.isInteger(parsedDelay) || parsedDelay < 0 || parsedDelay > 1440) {
      setActionError("Enter a whole-number delay from 0 to 1440 minutes.");
      return;
    }
    delayMutation.mutate({
      run: dialog.run,
      payload: {
        delay_minutes: parsedDelay,
        station_code: stationCode.trim() || null,
        notes: delayNotes.trim() || null,
      },
    });
  }

  function confirmCancellation() {
    if (dialog?.type !== "cancel") return;
    setActionError(null);
    cancelMutation.mutate({ run: dialog.run, reason: cancelReason.trim() });
  }

  function closeDialog() {
    setDialog(null);
    setActionError(null);
  }

  const loading = mode === "live" && tab === "runs" && runsQuery.isLoading;
  const runError = mode === "live" && tab === "runs" ? runsQuery.error : null;
  const chartData = mode === "demo" ? demoChart : selectedChartQuery.data;
  const chartError = mode === "live" ? selectedChartQuery.error : null;

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="Operations navigation">
        <div className="ops-sidebar-brand">
          <span className="ops-brand-mark" aria-hidden="true">R</span>
          <span><strong>RailYatri</strong><small>Rail operations</small></span>
        </div>
        <p className="ops-nav-label">Workspace</p>
        <nav className="ops-side-nav">
          <button type="button" className={tab === "runs" ? "ops-side-link ops-side-link--active" : "ops-side-link"} onClick={() => setTab("runs")}>▦ &nbsp; Staff console</button>
          {showAnalytics && (
            <button type="button" className={tab === "analytics" ? "ops-side-link ops-side-link--active" : "ops-side-link"} onClick={() => setTab("analytics")}>◩ &nbsp; Analytics</button>
          )}
        </nav>
        <div className="ops-sidebar-footer"><span className="ops-live-dot" aria-hidden="true" /> Operations workspace</div>
      </aside>

      <main className="ops-main">
        <header className="ops-header">
          <div>
            <p className="ops-eyebrow">Operations · control room</p>
            <h1>{tab === "runs" ? "Train operations." : "Admin analytics."}</h1>
            <p className="ops-subtitle">
              {tab === "runs" ? "Manage run status, delays, cancellations, and passenger charts." : "Review operational and revenue performance."}
            </p>
          </div>
          <div className="ops-mode-switch" role="group" aria-label="Dashboard data source">
            <button type="button" aria-pressed={mode === "live"} className={mode === "live" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"} onClick={() => { setMode("live"); setActionMessage(null); }}>
              Live API
            </button>
            <button type="button" aria-pressed={mode === "demo"} className={mode === "demo" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"} onClick={() => { setMode("demo"); setActionMessage(null); }}>
              Demo preview
            </button>
          </div>
        </header>

        {mode === "demo" ? (
          <div className="ops-demo-banner" role="status">
            <span className="ops-demo-icon" aria-hidden="true">i</span>
            <span><strong>Demo preview</strong> — examples below are not live runs, passenger records, or database results. Staff actions are disabled.</span>
          </div>
        ) : (
          <div className="ops-live-banner" role="status"><span className="ops-live-dot" aria-hidden="true" /> Live API mode — dashboard data comes from the operations service.</div>
        )}

        {tab === "runs" ? (
          <>
            <section className="ops-summary" aria-label="Run summary">
              <SummaryCard kicker="In view" label="Total runs" value={runs.length} icon="▦" color="blue" />
              <SummaryCard kicker="On schedule" label="Scheduled" value={runs.filter((run) => run.status === "SCHEDULED").length} icon="◷" color="blue" />
              <SummaryCard kicker="Attention" label="Delayed" value={runs.filter((run) => run.status === "DELAYED").length} icon="!" color="amber" />
              <SummaryCard kicker="Charts" label="Prepared" value={runs.filter((run) => run.chart_prepared).length} icon="✓" color="green" />
            </section>
            {actionMessage && <p className="ops-success" role="status">{actionMessage}</p>}
            {actionError && !dialog && <p className="ops-report-error" role="alert">{actionError}</p>}
            <section className="ops-runs-panel">
              <div className="ops-panel-heading">
                <div><h2>Train runs</h2><p>Set a run date to find a service, then manage operational actions.</p></div>
                <span className="ops-record-count">{runs.length} {runs.length === 1 ? "run" : "runs"}</span>
              </div>
              <div className="ops-filter-row">
                <div className="field ops-date-field">
                  <label htmlFor="ops-run-date">Run date</label>
                  <input id="ops-run-date" type="date" value={runDate} onChange={(event) => setRunDate(event.target.value)} />
                </div>
                {runDate && <button type="button" className="ops-clear-filter" onClick={() => setRunDate("")}>Clear date</button>}
                {runsQuery.isFetching && !loading && mode === "live" && <span className="ops-refreshing" role="status">Updating runs…</span>}
              </div>
              {loading && <p className="ops-state" role="status">Loading train runs…</p>}
              {runError && (
                <div className="ops-error-state" role="alert">
                  <strong>Couldn’t load train runs</strong><p>{friendlyActionError(runError)}</p>
                  <button type="button" className="ops-retry-button" disabled={runsQuery.isFetching} onClick={() => void runsQuery.refetch()}>
                    {runsQuery.isFetching ? "Retrying…" : "Retry"}
                  </button>
                </div>
              )}
              {!loading && !runError && runs.length === 0 && <p className="ops-state">No train runs found{runDate ? ` for ${runDate}` : ""}.</p>}
              {!loading && !runError && runs.length > 0 && (
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <caption className="sr-only">{mode === "demo" ? "Demo preview train runs" : "Train runs"}</caption>
                    <thead><tr><th scope="col">Train</th><th scope="col">Run date</th><th scope="col">Status</th><th scope="col">Delay</th><th scope="col">Chart</th><th scope="col">Staff actions</th></tr></thead>
                    <tbody>
                      {runs.map((run) => {
                        const active = ACTIVE_STATUSES.has(run.status);
                        return (
                          <tr key={run.run_id}>
                            <th scope="row"><span className="ops-train-number">{run.train_no}</span><span className="ops-train-name">{run.train_name}</span></th>
                            <td>{run.run_date}</td>
                            <td><span className={statusClass(run.status)}><span className="ops-status-dot" aria-hidden="true" />{run.status.toLowerCase()}</span></td>
                            <td><span className={`ops-delay ${run.delay_minutes > 0 ? "ops-delay--minor" : "ops-delay--none"}`}>{run.delay_minutes > 0 ? `${run.delay_minutes} min` : "On time"}</span></td>
                            <td>
                              {run.chart_prepared ? (
                                <button type="button" className="ops-inline-link" onClick={() => { setDialog({ type: "chart", run }); setActionError(null); }}>
                                  View chart
                                </button>
                              ) : (
                                <button type="button" className="ops-inline-link" disabled={!active || mode === "demo" || prepareMutation.isPending} title={!active ? "Inactive runs cannot prepare a chart" : mode === "demo" ? "Staff actions are disabled in demo mode" : undefined} onClick={() => { setActionMessage(null); setActionError(null); prepareMutation.mutate(run); }}>
                                  Prepare chart
                                </button>
                              )}
                            </td>
                            <td>
                              <div className="ops-row-actions">
                                <button type="button" disabled={!active || mode === "demo"} title={!active ? "Inactive runs cannot be edited" : mode === "demo" ? "Staff actions are disabled in demo mode" : undefined} onClick={() => openDelay(run)}>Delay</button>
                                <button type="button" className="ops-cancel-link" disabled={!active || mode === "demo"} title={!active ? "Inactive runs cannot be cancelled" : mode === "demo" ? "Staff actions are disabled in demo mode" : undefined} onClick={() => { cancelMutation.reset(); setCancelReason(""); setActionMessage(null); setActionError(null); setDialog({ type: "cancel", run }); }}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="ops-table-footer"><span>{mode === "demo" ? "Sample preview data" : "Operations API · page 1 · 50 per page"}</span>{runDate && <span>Filtered by {runDate}</span>}</div>
            </section>
          </>
        ) : (
          <Suspense fallback={<p className="ops-state" role="status">Loading analytics charts…</p>}>
            <AnalyticsPanel demo={mode === "demo"} />
          </Suspense>
        )}
        <footer className="ops-footer">RailYatri Operations · Train run monitoring</footer>
      </main>

      {dialog?.type === "delay" && (
        <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="ops-delay-title">
            <button type="button" className="ops-modal-close" aria-label="Close" onClick={closeDialog}>×</button>
            <p className="ops-eyebrow">Train {dialog.run.train_no}</p>
            <h2 id="ops-delay-title">Update delay</h2>
            <p className="ops-subtitle">{dialog.run.train_name} · {dialog.run.run_date}</p>
            <form className="ops-action-form" onSubmit={submitDelay}>
              <div className="field"><label htmlFor="ops-delay-minutes">Total delay (minutes)</label><input id="ops-delay-minutes" type="number" min="0" max="1440" step="1" required value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value)} /></div>
              <div className="field"><label htmlFor="ops-station-code">Station code (optional)</label><input id="ops-station-code" value={stationCode} onChange={(event) => setStationCode(event.target.value)} /></div>
              <div className="field"><label htmlFor="ops-delay-notes">Notes (optional)</label><textarea id="ops-delay-notes" rows={3} value={delayNotes} onChange={(event) => setDelayNotes(event.target.value)} /></div>
              {actionError && <p className="ops-report-error" role="alert">{actionError}</p>}
              <div className="ops-modal-actions"><button type="button" className="ops-secondary-button" onClick={closeDialog}>Back</button><button type="submit" className="ops-refresh-button" disabled={delayMutation.isPending}>{delayMutation.isPending ? "Saving…" : "Save delay"}</button></div>
            </form>
          </section>
        </div>
      )}

      {dialog?.type === "cancel" && (
        <div className="ops-modal-backdrop" role="presentation">
          <section className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="ops-cancel-title">
            <p className="ops-eyebrow">Destructive action · Train {dialog.run.train_no}</p>
            <h2 id="ops-cancel-title">Cancel this train run?</h2>
            <p className="ops-confirm-copy">This will cancel the run for every passenger and initiate a full refund. This action cannot be undone.</p>
            <div className="field"><label htmlFor="ops-cancel-reason">Reason (optional)</label><textarea id="ops-cancel-reason" rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
            {actionError && <p className="ops-report-error" role="alert">{actionError}</p>}
            {cancelMutation.data && (
              <p className="ops-success" role="status">
                Cancellation recorded: {cancelMutation.data.passengers_cancelled} passengers; ₹{cancelMutation.data.total_refunded.toLocaleString("en-IN")} refunded.
              </p>
            )}
            <div className="ops-modal-actions">
              <button type="button" className="ops-secondary-button" onClick={closeDialog}>{cancelMutation.isSuccess ? "Close" : "Keep run"}</button>
              <button type="button" className="ops-danger-button" disabled={cancelMutation.isPending || cancelMutation.isSuccess} onClick={confirmCancellation}>
                {cancelMutation.isPending ? "Cancelling…" : cancelMutation.isSuccess ? "Cancellation confirmed" : "Confirm cancellation"}
              </button>
            </div>
          </section>
        </div>
      )}

      {dialog?.type === "chart" && (
        <div className="ops-modal-backdrop" role="presentation">
          <section className="ops-modal ops-modal--wide" role="dialog" aria-modal="true" aria-labelledby="ops-chart-title">
            <button type="button" className="ops-modal-close" aria-label="Close" onClick={closeDialog}>×</button>
            <p className="ops-eyebrow">Passenger chart · Train {dialog.run.train_no}</p>
            <h2 id="ops-chart-title">{dialog.run.train_name}</h2>
            {mode === "live" && selectedChartQuery.isLoading && <p className="ops-state" role="status">Loading coach chart…</p>}
            {mode === "live" && chartError && <p className="ops-report-error" role="alert">{friendlyActionError(chartError)}</p>}
            {chartData && !chartError && <ChartContents chart={chartData} />}
            <div className="ops-modal-actions"><button type="button" className="ops-secondary-button" onClick={closeDialog}>Close</button></div>
          </section>
        </div>
      )}

      {mode === "live" && prepareMutation.error && !actionMessage && (
        <div className="ops-toast-error" role="alert">{friendlyActionError(prepareMutation.error)}</div>
      )}
    </div>
  );
}

function SummaryCard({
  kicker,
  label,
  value,
  icon,
  color,
}: {
  kicker: string;
  label: string;
  value: number;
  icon: string;
  color: "blue" | "amber" | "green";
}) {
  return (
    <article className="ops-summary-card">
      <div className="ops-summary-top">
        <span className={`ops-summary-icon ops-summary-icon--${color}`} aria-hidden="true">{icon}</span>
        <span className="ops-summary-kicker">{kicker}</span>
      </div>
      <strong className="ops-summary-value">{value}</strong>
      <span className="ops-summary-label">{label}</span>
    </article>
  );
}
