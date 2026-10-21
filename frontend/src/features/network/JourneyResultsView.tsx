import { useState } from "react";
import { Link } from "react-router-dom";
import {
  daysBetween,
  formatDateTimeClock,
  formatDay,
  formatDuration,
} from "./format";
import type { ConnectingJourney, JourneyResults, Leg } from "./types";

function LegRow({ leg }: { leg: Leg }) {
  const extraDays = daysBetween(leg.depart_at, leg.arrive_at);
  return (
    <div className="leg">
      <div className="leg-train">
        <Link to={`/trains/${leg.train_no}`}>
          <strong>{leg.train_no}</strong> {leg.train_name}
        </Link>
        <span className="muted">
          {leg.from_code} → {leg.to_code} · {leg.distance_km} km
        </span>
      </div>
      <div className="leg-times">
        <div>
          <time className="clock">{formatDateTimeClock(leg.depart_at)}</time>
          <span className="muted">{formatDay(leg.depart_at)}</span>
        </div>
        <div className="leg-duration" aria-label={`Duration ${formatDuration(leg.duration_minutes)}`}>
          <span>{formatDuration(leg.duration_minutes)}</span>
        </div>
        <div>
          <time className="clock">{formatDateTimeClock(leg.arrive_at)}</time>
          <span className="muted">
            {formatDay(leg.arrive_at)}
            {extraDays > 0 && <span className="badge">+{extraDays}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConnectingCard({ journey }: { journey: ConnectingJourney }) {
  return (
    <article className="card">
      <header className="card-head">
        <span>
          Change at <strong>{journey.interchange.name}</strong>{" "}
          <code>{journey.interchange.station_code}</code>
        </span>
        <span className="total">Total {formatDuration(journey.total_minutes)}</span>
      </header>
      <LegRow leg={journey.leg1} />
      <div className="wait" role="note">
        Wait {formatDuration(journey.wait_minutes)} at {journey.interchange.station_code}
      </div>
      <LegRow leg={journey.leg2} />
    </article>
  );
}

export function JourneyResultsView({ results }: { results: JourneyResults }) {
  const [tab, setTab] = useState<"direct" | "connecting">("direct");
  const tabs = [
    { key: "direct", label: "Direct", count: results.direct.length },
    { key: "connecting", label: "One change", count: results.connecting.length },
  ] as const;

  return (
    <section aria-label="Journey results">
      <div role="tablist" className="tabs">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
          >
            {label} <span className="count">{count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "direct" &&
          (results.direct.length === 0 ? (
            <p className="empty">
              No direct trains from {results.from_station.name} to {results.to_station.name} on{" "}
              {formatDay(results.date)}.
              {results.connecting.length > 0 && " Try the One change tab."}
            </p>
          ) : (
            results.direct.map((leg) => (
              <article className="card" key={`${leg.train_no}-${leg.run_date}`}>
                <LegRow leg={leg} />
              </article>
            ))
          ))}
        {tab === "connecting" &&
          (results.connecting.length === 0 ? (
            <p className="empty">
              No one-change journeys with a 30 minute to 6 hour wait were found.
            </p>
          ) : (
            results.connecting.map((journey) => (
              <ConnectingCard
                key={`${journey.leg1.train_no}-${journey.leg2.train_no}-${journey.interchange.station_code}`}
                journey={journey}
              />
            ))
          ))}
      </div>
    </section>
  );
}
