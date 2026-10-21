import { api } from "../../api/client";
import type { JourneyResults, StationPage, Timetable } from "./types";

export async function searchStations(q: string, pageSize = 8): Promise<StationPage> {
  const { data } = await api.get<StationPage>("/stations", {
    params: { q, page_size: pageSize },
  });
  return data;
}

export async function searchJourneys(
  from: string,
  to: string,
  date: string,
): Promise<JourneyResults> {
  const { data } = await api.get<JourneyResults>("/journeys", {
    params: { from, to, date },
  });
  return data;
}

export async function fetchTimetable(trainNo: string): Promise<Timetable> {
  const { data } = await api.get<Timetable>(
    `/trains/${encodeURIComponent(trainNo)}/timetable`,
  );
  return data;
}
