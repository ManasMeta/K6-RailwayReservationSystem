import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { errorMessage } from "../../api/client";
import { fetchTrainRuns } from "./api";
import { demoTrainRuns } from "./demoData";
import "./operations.css";

type DataMode = "demo" | "live";

function statusClass(status: string): string {
  const normalized = status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `ops-status ops-status--${normalized}`;
}

function delayLabel(minutes: number): string {
  if (minutes <= 0) return "On time";
  if (minutes <= 15) return "Minor delay";
  return "Delayed";
}

export function OperationsPage() {
  const [dataMode, setDataMode] = useState<DataMode>("demo");
  const [runDate, setRunDate] = useState("");
  const liveRuns = useQuery({
    queryKey: ["ops", "runs", runDate],
    queryFn: () => fetchTrainRuns(runDate || undefined),
    enabled: dataMode === "live",
  });

  const runs = useMemo(() => {
    if (dataMode === "live") return liveRuns.data ?? [];
    return runDate
      ? demoTrainRuns.filter((run) => run.run_date === runDate)
      : demoTrainRuns;
  }, [dataMode, liveRuns.data, runDate]);

  const totalRuns = runs.length;
  const runningRuns = runs.filter((run) => run.status.toUpperCase() === "RUNNING").length;
  const delayedRuns = runs.filter((run) => run.delay_minutes > 0).length;
  const chartsPrepared = runs.filter((run) => run.chart_prepared).length;
  const isLoading = dataMode === "live" && liveRuns.isLoading;
  const error = dataMode === "live" ? liveRuns.error : null;
  const isFetching = dataMode === "live" && liveRuns.isFetching;
  const summaryUnknown = dataMode === "live" && (isLoading || Boolean(error) || liveRuns.data === undefined);
  const summaryValue = (value: number | string) => summaryUnknown ? "—" : value;

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="Operations navigation">
        <div className="ops-sidebar-brand">
          <span className="ops-brand-mark" aria-hidden="true">Y</span>
          <span>
            <strong>Yatrio</strong>
            <small>RAIL OPERATIONS</small>
          </span>
        </div>
        <p className="ops-nav-label">WORKSPACE</p>
        <nav className="ops-side-nav">
          <a className="ops-side-link" href="#overview" aria-current="page">
            <span aria-hidden="true">▦</span> Overview
          </a>
          <a className="ops-side-link ops-side-link--active" href="#train-runs">
            <span aria-hidden="true">↗</span> Train runs
          </a>
        </nav>
        <div className="ops-sidebar-footer">
          <span className="ops-live-dot" aria-hidden="true" />
          Operations workspace
        </div>
      </aside>

      <main className="ops-main">
        <header className="ops-header">
          <div>
            <p className="ops-eyebrow">OPERATIONS / CONTROL ROOM</p>
            <h1>Train operations</h1>
            <p className="ops-subtitle">Monitor daily train runs and chart readiness.</p>
          </div>
          <div className="ops-mode-switch" role="group" aria-label="Dashboard data source">
            <button
              type="button"
              aria-pressed={dataMode === "demo"}
              className={dataMode === "demo" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"}
              onClick={() => setDataMode("demo")}
            >
              Demo preview
            </button>
            <button
              type="button"
              aria-pressed={dataMode === "live"}
              className={dataMode === "live" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"}
              onClick={() => setDataMode("live")}
            >
              Live API
            </button>
          </div>
        </header>

        {dataMode === "demo" ? (
          <div className="ops-demo-banner" role="status">
            <span className="ops-demo-icon" aria-hidden="true">i</span>
            <span>
              <strong>Demo preview</strong> — sample records for interface preview only. These are not
              live trains or database records.
            </span>
          </div>
        ) : (
          <div className="ops-live-banner" role="status">
            <span className="ops-live-dot" aria-hidden="true" />
            Live API mode — data is requested from the operations service.
          </div>
        )}

        <section id="overview" className="ops-summary" aria-label="Run summary">
          <article className="ops-summary-card">
            <div className="ops-summary-top">
              <span className="ops-summary-icon ops-summary-icon--blue" aria-hidden="true">▦</span>
              <span className="ops-summary-kicker">IN VIEW</span>
            </div>
            <strong className="ops-summary-value">{summaryValue(totalRuns)}</strong>
            <span className="ops-summary-label">Total train runs</span>
          </article>
          <article className="ops-summary-card">
            <div className="ops-summary-top">
              <span className="ops-summary-icon ops-summary-icon--green" aria-hidden="true">↗</span>
              <span className="ops-summary-kicker">ACTIVE</span>
            </div>
            <strong className="ops-summary-value">{summaryValue(runningRuns)}</strong>
            <span className="ops-summary-label">Currently running</span>
          </article>
          <article className="ops-summary-card">
            <div className="ops-summary-top">
              <span className="ops-summary-icon ops-summary-icon--amber" aria-hidden="true">◷</span>
              <span className="ops-summary-kicker">ATTENTION</span>
            </div>
            <strong className="ops-summary-value">{summaryValue(delayedRuns)}</strong>
            <span className="ops-summary-label">Runs with a delay</span>
          </article>
          <article className="ops-summary-card">
            <div className="ops-summary-top">
              <span className="ops-summary-icon ops-summary-icon--violet" aria-hidden="true">✓</span>
              <span className="ops-summary-kicker">READINESS</span>
            </div>
            <strong className="ops-summary-value">
              {summaryValue(`${chartsPrepared}/${totalRuns}`)}
            </strong>
            <span className="ops-summary-label">Charts prepared</span>
          </article>
        </section>

        <section id="train-runs" className="ops-runs-panel">
          <div className="ops-panel-heading">
            <div>
              <h2>Train runs</h2>
              <p>Run status and chart preparation for the selected date.</p>
            </div>
            <span className="ops-record-count">
              {summaryUnknown ? "— runs" : `${totalRuns} ${totalRuns === 1 ? "run" : "runs"}`}
            </span>
          </div>

          <div className="ops-filter-row">
            <div className="field ops-date-field">
              <label htmlFor="ops-run-date">Run date</label>
              <input
                id="ops-run-date"
                type="date"
                value={runDate}
                onChange={(event) => setRunDate(event.target.value)}
              />
            </div>
            {runDate && (
              <button type="button" className="ops-clear-filter" onClick={() => setRunDate("")}>
                Clear date
              </button>
            )}
            {isFetching && !isLoading && (
              <span className="ops-refreshing" role="status">Updating runs…</span>
            )}
          </div>

          {isLoading && <p className="ops-state" role="status">Loading train runs…</p>}

          {error && (
            <div className="ops-error-state" role="alert">
              <strong>Couldn’t load train runs</strong>
              <p>{errorMessage(error)}</p>
              <button
                type="button"
                className="ops-retry-button"
                disabled={isFetching}
                onClick={() => void liveRuns.refetch()}
              >
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          )}

          {!isLoading && !error && runs.length === 0 && (
            <p className="ops-state">
              No train runs found{runDate ? ` for ${runDate}` : ""}.
            </p>
          )}

          {!isLoading && !error && runs.length > 0 && (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <caption className="sr-only">
                  {dataMode === "demo" ? "Demo preview train runs" : "Live train runs"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Train</th>
                    <th scope="col">Run date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Delay</th>
                    <th scope="col">Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.run_id}>
                      <th scope="row">
                        <span className="ops-train-number">{run.train_no}</span>
                        <span className="ops-train-name">{run.train_name}</span>
                      </th>
                      <td>{run.run_date}</td>
                      <td>
                        <span className={statusClass(run.status)}>
                          <span className="ops-status-dot" aria-hidden="true" />
                          {run.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <span className={`ops-delay ${run.delay_minutes > 15 ? "ops-delay--high" : run.delay_minutes > 0 ? "ops-delay--minor" : "ops-delay--none"}`}>
                          {run.delay_minutes > 0 ? `${run.delay_minutes} min` : "On time"}
                        </span>
                        {run.delay_minutes > 0 && (
                          <span className="ops-delay-note">{delayLabel(run.delay_minutes)}</span>
                        )}
                      </td>
                      <td>
                        <span className={run.chart_prepared ? "ops-chart ops-chart--ready" : "ops-chart ops-chart--pending"}>
                          <span aria-hidden="true">{run.chart_prepared ? "✓" : "•"}</span>
                          {run.chart_prepared ? "Prepared" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="ops-table-footer">
            <span>{dataMode === "demo" ? "Sample preview data" : "Operations API"}</span>
            {runDate && <span>Filtered by {runDate}</span>}
          </div>
        </section>
        <footer className="ops-footer">Yatrio Operations · Train run monitoring</footer>
      </main>
    </div>
  );
}
