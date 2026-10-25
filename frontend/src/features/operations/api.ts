import { api } from "../../api/client";

export interface TrainRun {
  run_id: number;
  train_no: string;
  train_name: string;
  run_date: string;
  status: string;
  delay_minutes: number;
  chart_prepared: boolean;
}

export async function fetchTrainRuns(runDate?: string): Promise<TrainRun[]> {
  const { data } = await api.get<TrainRun[]>("/ops/runs", {
    params: runDate ? { run_date: runDate } : undefined,
  });
  return data;
}
