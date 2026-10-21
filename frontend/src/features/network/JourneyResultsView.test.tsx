import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { JourneyResultsView } from "./JourneyResultsView";
import type { JourneyResults, Leg } from "./types";

const leg1: Leg = {
  train_no: "12301",
  train_name: "HOWRAH RAJDHANI",
  run_date: "2026-11-02",
  from_code: "HWH",
  to_code: "CNB",
  from_seq: 1,
  to_seq: 3,
  depart_at: "2026-11-02T16:55:00",
  arrive_at: "2026-11-03T04:20:00",
  duration_minutes: 685,
  distance_km: 910,
};
const leg2: Leg = {
  train_no: "12420",
  train_name: "LUCKNOW MAIL",
  run_date: "2026-11-03",
  from_code: "CNB",
  to_code: "LKO",
  from_seq: 1,
  to_seq: 2,
  depart_at: "2026-11-03T05:30:00",
  arrive_at: "2026-11-03T07:00:00",
  duration_minutes: 90,
  distance_km: 74,
};

const results: JourneyResults = {
  from_station: { station_code: "HWH", name: "HOWRAH JN" },
  to_station: { station_code: "LKO", name: "LUCKNOW NR" },
  date: "2026-11-02",
  direct: [],
  connecting: [
    {
      rank: 1,
      interchange: { station_code: "CNB", name: "KANPUR CENTRAL" },
      wait_minutes: 70,
      total_minutes: 845,
      leg1,
      leg2,
    },
  ],
};

function renderResults(value: JourneyResults) {
  return render(
    <MemoryRouter>
      <JourneyResultsView results={value} />
    </MemoryRouter>,
  );
}

describe("JourneyResultsView", () => {
  it("shows tab counts and an empty direct state that points to the One change tab", () => {
    renderResults(results);

    expect(screen.getByRole("tab", { name: /Direct/ })).toHaveTextContent("0");
    expect(screen.getByRole("tab", { name: /One change/ })).toHaveTextContent("1");
    expect(screen.getByText(/No direct trains from HOWRAH JN/)).toHaveTextContent(
      "Try the One change tab",
    );
  });

  it("shows total time and the wait at the interchange", async () => {
    renderResults(results);

    await userEvent.click(screen.getByRole("tab", { name: /One change/ }));

    expect(screen.getByText("Total 14h 5m")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Wait 1h 10m at CNB");
    expect(screen.getByRole("link", { name: /12301/ })).toHaveAttribute("href", "/trains/12301");
    expect(screen.getByText("+1")).toBeInTheDocument(); // leg 1 arrives the next day
  });

  it("lists direct trains", () => {
    renderResults({ ...results, direct: [leg1], connecting: [] });

    expect(screen.getByRole("link", { name: /12301/ })).toBeInTheDocument();
    expect(screen.getByText("16:55")).toBeInTheDocument();
  });
});
