import type {
  BusiestSegment,
  OccupancyByClassRow,
  PNRResponse,
  PreparedChartResponse,
  RevenueByDayRow,
  TrainRun,
  WaitingListConversionResponse,
} from "./types";

// Preview-only examples; live API functions never read or return this module.
export const demoTrainRuns: TrainRun[] = [
  { run_id: -1, train_no: "12002", train_name: "Bhopal Shatabdi", run_date: "2026-10-25", status: "DELAYED", delay_minutes: 18, chart_prepared: true },
  { run_id: -2, train_no: "12951", train_name: "Mumbai Rajdhani", run_date: "2026-10-25", status: "DELAYED", delay_minutes: 32, chart_prepared: true },
  { run_id: -3, train_no: "12627", train_name: "Karnataka Express", run_date: "2026-10-25", status: "SCHEDULED", delay_minutes: 0, chart_prepared: false },
  { run_id: -4, train_no: "12301", train_name: "Howrah Rajdhani", run_date: "2026-10-25", status: "DEPARTED", delay_minutes: 4, chart_prepared: true },
  { run_id: -5, train_no: "12622", train_name: "Tamil Nadu Express", run_date: "2026-10-26", status: "CANCELLED", delay_minutes: 0, chart_prepared: false },
  { run_id: -6, train_no: "12952", train_name: "Mumbai Rajdhani", run_date: "2026-10-26", status: "SCHEDULED", delay_minutes: 0, chart_prepared: false },
];

export const demoChart: PreparedChartResponse = {
  chart_id: "preview-chart",
  run_id: -1,
  prepared_at: "2026-10-25T07:00:00Z",
  final_vacant_berths: 12,
  entries: [
    { passenger_id: -1, pnr: "1000000000", name: "A**** K****", status: "CNF", coach_code: "A1", berth_no: 18, berth_type: "LOWER", quota_code: "GN" },
    { passenger_id: -2, pnr: "1000000001", name: "R**** S****", status: "RAC", coach_code: "A1", berth_no: null, berth_type: null, quota_code: "GN" },
    { passenger_id: -3, pnr: "1000000002", name: "M**** P****", status: "WL", coach_code: null, berth_no: null, berth_type: null, quota_code: "TQ" },
    { passenger_id: -4, pnr: "1000000003", name: "S**** R****", status: "CNF", coach_code: "B2", berth_no: 26, berth_type: "UPPER", quota_code: "GN" },
  ],
};

export const demoPNR: PNRResponse = {
  pnr: "1000000000",
  reservation_status: "CONFIRMED",
  train_no: "12002",
  train_name: "Bhopal Shatabdi",
  run_date: "2026-10-25",
  from_station_code: "NDLS",
  from_station_name: "New Delhi",
  to_station_code: "BPL",
  to_station_name: "Bhopal Junction",
  class_code: "CC",
  quota_code: "GN",
  run_status: "DELAYED",
  delay_minutes: 18,
  chart_prepared: true,
  passengers: [
    { name: "A**** K****", status: "CNF", coach_code: "C1", berth_no: 18, berth_type: "WINDOW", rac_number: null, wl_number: null },
    { name: "R**** S****", status: "RAC", coach_code: "C1", berth_no: null, berth_type: null, rac_number: 4, wl_number: null },
  ],
};

export const demoRevenue: RevenueByDayRow[] = [
  { day: "2026-10-20", class_code: "CC", bookings: 124, gross: 86800, refunded: 2600, net: 84200 },
  { day: "2026-10-20", class_code: "2A", bookings: 52, gross: 104000, refunded: 4000, net: 100000 },
  { day: "2026-10-21", class_code: "CC", bookings: 138, gross: 96600, refunded: 3200, net: 93400 },
  { day: "2026-10-21", class_code: "2A", bookings: 61, gross: 122000, refunded: 5000, net: 117000 },
  { day: "2026-10-22", class_code: "CC", bookings: 151, gross: 105700, refunded: 1800, net: 103900 },
  { day: "2026-10-22", class_code: "2A", bookings: 67, gross: 134000, refunded: 6000, net: 128000 },
  { day: "2026-10-23", class_code: "CC", bookings: 143, gross: 100100, refunded: 2300, net: 97800 },
  { day: "2026-10-23", class_code: "2A", bookings: 72, gross: 144000, refunded: 4200, net: 139800 },
];

export const demoOccupancy: OccupancyByClassRow[] = [
  { class_code: "1A", total_berths: 120, booked_berths: 104, occupancy_pct: 86.7 },
  { class_code: "2A", total_berths: 540, booked_berths: 487, occupancy_pct: 90.2 },
  { class_code: "3A", total_berths: 840, booked_berths: 722, occupancy_pct: 86 },
  { class_code: "SL", total_berths: 1260, booked_berths: 1018, occupancy_pct: 80.8 },
  { class_code: "CC", total_berths: 360, booked_berths: 298, occupancy_pct: 82.8 },
];

export const demoWaitingList: WaitingListConversionResponse = {
  waiting: 286,
  promoted: 173,
  conversion_pct: 60.5,
};

export const demoSegments: BusiestSegment[] = [
  { train_no: "12002", train_name: "Bhopal Shatabdi", from_station_code: "NDLS", from_station_name: "New Delhi", to_station_code: "AGC", to_station_name: "Agra Cantt", passengers: 386 },
  { train_no: "12951", train_name: "Mumbai Rajdhani", from_station_code: "BRC", from_station_name: "Vadodara", to_station_code: "MMCT", to_station_name: "Mumbai Central", passengers: 352 },
  { train_no: "12301", train_name: "Howrah Rajdhani", from_station_code: "NDLS", from_station_name: "New Delhi", to_station_code: "CNB", to_station_name: "Kanpur Central", passengers: 328 },
  { train_no: "12627", train_name: "Karnataka Express", from_station_code: "SBC", from_station_name: "KSR Bengaluru", to_station_code: "GTL", to_station_name: "Guntakal", passengers: 294 },
];
