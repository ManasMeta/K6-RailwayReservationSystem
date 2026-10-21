import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { fetchTimetable } from "./api";
import { formatClock, formatRunningDays } from "./format";

export function TimetablePage() {
  const { trainNo = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["timetable", trainNo],
    queryFn: () => fetchTimetable(trainNo),
    enabled: trainNo !== "",
  });

  return (
    <main className="page">
      <p><Link to="/">← Back to search</Link></p>
      {isLoading && <p role="status">Loading timetable…</p>}
      {error && <p className="error" role="alert">{errorMessage(error)}</p>}
      {data && (
        <>
          <h1>
            {data.train_no} {data.name}
          </h1>
          <p className="lede">
            {data.source && data.destination
              ? `${data.source.name} → ${data.destination.name} · `
              : ""}
            Runs {formatRunningDays(data.running_days)}
          </p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Stops of train {data.train_no}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Station</th>
                  <th scope="col">Arrives</th>
                  <th scope="col">Departs</th>
                  <th scope="col">Day</th>
                  <th scope="col">Km</th>
                </tr>
              </thead>
              <tbody>
                {data.stops.map((stop) => (
                  <tr key={stop.seq}>
                    <td>{stop.seq}</td>
                    <th scope="row">
                      {stop.station_name} <code>{stop.station_code}</code>
                    </th>
                    <td>{formatClock(stop.arrival)}</td>
                    <td>{formatClock(stop.departure)}</td>
                    <td>{stop.day_offset + 1}</td>
                    <td>{stop.distance_km}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
