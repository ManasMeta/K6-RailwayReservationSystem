import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { searchJourneys } from "./api";
import { isoDate } from "./format";
import { JourneyResultsView } from "./JourneyResultsView";
import { StationAutocomplete } from "./StationAutocomplete";
import type { Station } from "./types";

const asStation = (code: string | null): Station | null =>
  code ? { station_code: code, name: code } : null;

export function JourneySearchPage() {
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState<Station | null>(asStation(params.get("from")));
  const [to, setTo] = useState<Station | null>(asStation(params.get("to")));
  const [date, setDate] = useState(params.get("date") ?? isoDate(1));
  const [formError, setFormError] = useState<string | null>(null);

  const submitted = {
    from: params.get("from"),
    to: params.get("to"),
    date: params.get("date"),
  };
  const hasSearch = Boolean(submitted.from && submitted.to && submitted.date);

  const { data, isFetching, error } = useQuery({
    queryKey: ["journeys", submitted.from, submitted.to, submitted.date],
    queryFn: () => searchJourneys(submitted.from!, submitted.to!, submitted.date!),
    enabled: hasSearch,
  });

  // A search opened from a shared link only knows station codes; adopt the real names.
  useEffect(() => {
    if (!data) return;
    const named = (s: Station | null, real: Station) =>
      s && s.station_code === real.station_code && s.name !== real.name ? real : s;
    setFrom((s) => named(s, data.from_station));
    setTo((s) => named(s, data.to_station));
  }, [data]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!from || !to) return setFormError("Choose both stations from the suggestions.");
    if (from.station_code === to.station_code)
      return setFormError("Origin and destination must be different.");
    if (!date) return setFormError("Choose a travel date.");
    setFormError(null);
    setParams({ from: from.station_code, to: to.station_code, date });
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <main className="page">
      <h1>Find a train</h1>
      <p className="lede">Direct trains and journeys with one change, between any two stations.</p>

      <form className="search" onSubmit={onSubmit} noValidate>
        <StationAutocomplete label="From" value={from} onChange={setFrom} />
        <button type="button" className="swap" onClick={swap} aria-label="Swap stations">
          ⇄
        </button>
        <StationAutocomplete label="To" value={to} onChange={setTo} />
        <div className="field">
          <label htmlFor="travel-date">Date</label>
          <input
            id="travel-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button type="submit" className="primary" disabled={isFetching}>
          {isFetching ? "Searching…" : "Search"}
        </button>
      </form>

      {formError && <p className="error" role="alert">{formError}</p>}
      {error && <p className="error" role="alert">{errorMessage(error)}</p>}
      {data && <JourneyResultsView key={`${submitted.from}${submitted.to}${submitted.date}`} results={data} />}
    </main>
  );
}
