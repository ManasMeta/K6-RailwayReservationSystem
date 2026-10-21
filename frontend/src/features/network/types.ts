export interface Station {
  station_code: string;
  name: string;
}

export interface StationPage {
  items: Station[];
  page: number;
  page_size: number;
  total: number;
}

export interface Leg {
  train_no: string;
  train_name: string;
  run_date: string;
  from_code: string;
  to_code: string;
  from_seq: number;
  to_seq: number;
  depart_at: string;
  arrive_at: string;
  duration_minutes: number;
  distance_km: number;
}

export interface ConnectingJourney {
  rank: number;
  interchange: Station;
  wait_minutes: number;
  total_minutes: number;
  leg1: Leg;
  leg2: Leg;
}

export interface JourneyResults {
  from_station: Station;
  to_station: Station;
  date: string;
  direct: Leg[];
  connecting: ConnectingJourney[];
}

export interface Stop {
  seq: number;
  station_code: string;
  station_name: string;
  arrival: string | null;
  departure: string | null;
  day_offset: number;
  distance_km: number;
}

export interface Timetable {
  train_no: string;
  name: string;
  source: Station | null;
  destination: Station | null;
  running_days: number[];
  stops: Stop[];
}
