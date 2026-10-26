export type RunStatus = "SCHEDULED" | "DELAYED" | "CANCELLED" | "DEPARTED";

export interface TrainRun {
  run_id: number;
  train_no: string;
  train_name: string;
  run_date: string;
  status: RunStatus;
  delay_minutes: number;
  chart_prepared: boolean;
}

export interface UpdateDelayRequest {
  delay_minutes: number;
  station_code: string | null;
  notes: string | null;
}

export type UpdateDelayResponse = TrainRun;

export interface CancelRunResponse {
  run_id: number;
  status: "CANCELLED";
  passengers_cancelled: number;
  total_refunded: number;
}

export interface PrepareChartResponse {
  run_id: number;
  chart_id: number | string;
  promoted: number;
  remaining_rac: number;
  remaining_wl: number;
  final_vacant_berths: number;
  already_prepared: boolean;
}

export type ChartPassengerStatus = "CNF" | "RAC" | "WL";

export interface ChartEntry {
  passenger_id: number | string;
  pnr: string;
  name: string;
  status: ChartPassengerStatus;
  coach_code: string | null;
  berth_no: number | null;
  berth_type: string | null;
  quota_code: string | null;
}

export interface PreparedChartResponse {
  chart_id: number | string;
  run_id: number;
  prepared_at: string;
  final_vacant_berths: number;
  entries: ChartEntry[];
}

export type PassengerReservationStatus = "CNF" | "RAC" | "WL" | "CANCELLED";

export interface PNRPassenger {
  name: string;
  status: PassengerReservationStatus;
  coach_code: string | null;
  berth_no: number | null;
  berth_type: string | null;
  rac_number: number | null;
  wl_number: number | null;
}

export interface PNRResponse {
  pnr: string;
  reservation_status: string;
  train_no: string;
  train_name: string;
  run_date: string;
  from_station_code: string;
  from_station_name: string;
  to_station_code: string;
  to_station_name: string;
  class_code: string;
  quota_code: string;
  run_status: RunStatus;
  delay_minutes: number;
  chart_prepared: boolean;
  passengers: PNRPassenger[];
}

export interface RevenueByDayRow {
  day: string;
  class_code: string;
  bookings: number;
  gross: number;
  refunded: number;
  net: number;
}

export interface OccupancyByClassRow {
  class_code: string;
  total_berths: number;
  booked_berths: number;
  occupancy_pct: number;
}

export interface WaitingListConversionResponse {
  waiting: number;
  promoted: number;
  conversion_pct: number | null;
}

export interface BusiestSegment {
  train_no: string;
  train_name: string;
  from_station_code: string;
  from_station_name: string;
  to_station_code: string;
  to_station_name: string;
  passengers: number;
}
