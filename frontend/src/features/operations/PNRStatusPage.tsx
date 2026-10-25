import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../../api/client";
import { apiErrorCode, fetchPNR } from "./api";
import { demoPNR } from "./demoData";
import type { PNRResponse } from "./types";

type PNRMode = "live" | "demo";

function pnrErrorMessage(error: unknown): string {
  const code = apiErrorCode(error);
  if (code === "INVALID_PNR") return "Enter a valid 10-digit PNR number.";
  if (code === "PNR_NOT_FOUND") return "No reservation was found for this PNR.";
  return errorMessage(error);
}

function PassengerTable({ pnr }: { pnr: PNRResponse }) {
  return (
    <section className="ops-pnr-panel">
      <div className="ops-panel-heading">
        <div><h2>Passengers</h2><p>Passenger names are masked for privacy.</p></div>
        <span className="ops-record-count">{pnr.passengers.length} passengers</span>
      </div>
      <div className="ops-table-wrap">
        <table className="ops-table ops-pnr-table">
          <caption className="sr-only">Passenger reservation status</caption>
          <thead><tr><th scope="col">Passenger</th><th scope="col">Status</th><th scope="col">Coach</th><th scope="col">Berth</th></tr></thead>
          <tbody>
            {pnr.passengers.map((passenger, index) => (
              <tr key={`${passenger.name}-${index}`}>
                <th scope="row">{passenger.name}</th>
                <td><span className={`ops-status ops-status--${passenger.status.toLowerCase()}`}>{passenger.status}</span></td>
                <td>{passenger.coach_code ?? "—"}</td>
                <td>
                  {passenger.berth_no !== null
                    ? `${passenger.berth_no}${passenger.berth_type ? ` · ${passenger.berth_type}` : ""}`
                    : passenger.rac_number !== null
                      ? `RAC ${passenger.rac_number}`
                      : passenger.wl_number !== null
                        ? `WL ${passenger.wl_number}`
                        : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PNRDetails({ pnr }: { pnr: PNRResponse }) {
  return (
    <div className="ops-pnr-results">
      <section className="ops-pnr-panel">
        <div className="ops-panel-heading">
          <div><p className="ops-eyebrow">RESERVATION · PNR {pnr.pnr}</p><h2>{pnr.train_no} · {pnr.train_name}</h2></div>
          <span className={pnr.reservation_status.toLowerCase() === "confirmed" ? "ops-status ops-status--cnf" : "ops-status"}>
            {pnr.reservation_status.replace(/_/g, " ")}
          </span>
        </div>
        <dl className="ops-pnr-details">
          <div><dt>Journey</dt><dd>{pnr.from_station_name} <span>({pnr.from_station_code})</span> → {pnr.to_station_name} <span>({pnr.to_station_code})</span></dd></div>
          <div><dt>Run date</dt><dd>{pnr.run_date}</dd></div>
          <div><dt>Class / quota</dt><dd>{pnr.class_code} / {pnr.quota_code}</dd></div>
          <div><dt>Train status</dt><dd><span className={statusClassForPNR(pnr.run_status)}>{pnr.run_status}</span>{pnr.delay_minutes > 0 ? ` · ${pnr.delay_minutes} min delay` : ""}</dd></div>
          <div><dt>Chart</dt><dd>{pnr.chart_prepared ? "Prepared" : "Not prepared"}</dd></div>
        </dl>
      </section>
      <PassengerTable pnr={pnr} />
    </div>
  );
}

function statusClassForPNR(status: string): string {
  return `ops-status ops-status--${status.toLowerCase()}`;
}

export function PNRStatusPage() {
  const [mode, setMode] = useState<PNRMode>("live");
  const [pnr, setPnr] = useState("");
  const [submittedPNR, setSubmittedPNR] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const validSubmittedPNR = /^\d{10}$/.test(submittedPNR);
  const liveQuery = useQuery({
    queryKey: ["public-pnr", submittedPNR],
    queryFn: () => fetchPNR(submittedPNR),
    enabled: mode === "live" && validSubmittedPNR,
  });
  const demoResult = mode === "demo" && submittedPNR === demoPNR.pnr ? demoPNR : undefined;
  const result = mode === "live" ? liveQuery.data : demoResult;
  const queryError = mode === "live" ? liveQuery.error : null;
  const isLoading = mode === "live" && liveQuery.isLoading;
  const demoNotFound = mode === "demo" && validSubmittedPNR && submittedPNR !== demoPNR.pnr;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{10}$/.test(pnr)) {
      setValidationMessage("PNR must contain exactly 10 digits.");
      setSubmittedPNR("");
      return;
    }
    setValidationMessage(null);
    setSubmittedPNR(pnr);
  }

  return (
    <main className="ops-pnr-page">
      <header className="ops-pnr-header">
        <p className="ops-eyebrow">YATRIO · PASSENGER SERVICES</p>
        <h1>Check PNR status</h1>
        <p className="ops-subtitle">View reservation and passenger status using your 10-digit PNR.</p>
      </header>

      <section className="ops-pnr-search">
        <div className="ops-pnr-mode">
          <span>Data source</span>
          <div className="ops-mode-switch" role="group" aria-label="PNR data source">
            <button type="button" aria-pressed={mode === "live"} className={mode === "live" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"} onClick={() => setMode("live")}>Live status</button>
            <button type="button" aria-pressed={mode === "demo"} className={mode === "demo" ? "ops-mode-button ops-mode-button--active" : "ops-mode-button"} onClick={() => setMode("demo")}>Demo preview</button>
          </div>
        </div>
        {mode === "demo" && (
          <p className="ops-demo-banner" role="status">
            <span className="ops-demo-icon" aria-hidden="true">i</span>
            Demo preview only — sample passenger details, not a live reservation. Demo PNR: <strong>1000000000</strong>
          </p>
        )}
        <form className="ops-pnr-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="public-pnr">10-digit PNR number</label>
            <input
              id="public-pnr"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              value={pnr}
              onChange={(event) => setPnr(event.target.value.replace(/\D/g, "").slice(0, 10))}
              aria-invalid={Boolean(validationMessage)}
              aria-describedby="pnr-hint"
            />
            <span id="pnr-hint" className={validationMessage ? "hint error" : "hint"}>
              {validationMessage ?? "Enter the 10-digit number from your ticket."}
            </span>
          </div>
          <button type="submit" className="ops-refresh-button" disabled={isLoading}>
            {isLoading ? "Checking…" : "Check status"}
          </button>
        </form>
      </section>

      {isLoading && <p className="ops-state" role="status">Checking reservation status…</p>}
      {queryError && <p className="ops-pnr-error" role="alert">{pnrErrorMessage(queryError)}</p>}
      {demoNotFound && <p className="ops-pnr-error" role="alert">No demo reservation found. The demo PNR is 1000000000.</p>}
      {result && <PNRDetails pnr={result} />}
    </main>
  );
}
