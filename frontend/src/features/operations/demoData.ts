import type { TrainRun } from "./api";

// Preview-only examples; never returned by or passed to the live API client.
export const demoTrainRuns: TrainRun[] = [
  {
    run_id: -1,
    train_no: "12002",
    train_name: "Bhopal Shatabdi",
    run_date: "2026-10-25",
    status: "RUNNING",
    delay_minutes: 0,
    chart_prepared: true,
  },
  {
    run_id: -2,
    train_no: "12951",
    train_name: "Mumbai Rajdhani",
    run_date: "2026-10-25",
    status: "RUNNING",
    delay_minutes: 18,
    chart_prepared: true,
  },
  {
    run_id: -3,
    train_no: "12627",
    train_name: "Karnataka Express",
    run_date: "2026-10-25",
    status: "SCHEDULED",
    delay_minutes: 7,
    chart_prepared: false,
  },
  {
    run_id: -4,
    train_no: "12301",
    train_name: "Howrah Rajdhani",
    run_date: "2026-10-25",
    status: "COMPLETED",
    delay_minutes: 4,
    chart_prepared: true,
  },
  {
    run_id: -5,
    train_no: "12622",
    train_name: "Tamil Nadu Express",
    run_date: "2026-10-26",
    status: "SCHEDULED",
    delay_minutes: 0,
    chart_prepared: false,
  },
  {
    run_id: -6,
    train_no: "12952",
    train_name: "Mumbai Rajdhani",
    run_date: "2026-10-26",
    status: "RUNNING",
    delay_minutes: 32,
    chart_prepared: true,
  },
];
