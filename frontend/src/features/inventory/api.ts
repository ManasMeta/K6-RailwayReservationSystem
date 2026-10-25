import { api } from "../../api/client";
import type {
  AvailabilityResponse,
  CoachLayoutResponse,
  CoachSummary,
  FareBreakdown,
} from "./types";

export async function fetchAvailability(
  trainNo: string,
  fromCode: string,
  toCode: string,
  date: string,
  quota = "GN",
  days = 6
): Promise<AvailabilityResponse> {
  const { data } = await api.get<AvailabilityResponse>(
    `/trains/${trainNo}/availability`,
    {
      params: {
        from: fromCode,
        to: toCode,
        date,
        quota,
        days,
      },
    }
  );
  return data;
}

export async function fetchFare(
  trainNo: string,
  fromCode: string,
  toCode: string,
  classCode: string,
  quota = "GN",
  concession = "GENERAL"
): Promise<FareBreakdown> {
  const { data } = await api.get<FareBreakdown>("/fare", {
    params: {
      train_no: trainNo,
      from: fromCode,
      to: toCode,
      class_code: classCode,
      quota,
      concession,
    },
  });
  return data;
}

export async function fetchTrainCoaches(trainNo: string): Promise<CoachSummary[]> {
  const { data } = await api.get<CoachSummary[]>(`/trains/${trainNo}/coaches`);
  return data;
}

export async function fetchCoachLayout(
  coachId: number,
  runDate: string,
  fromSeq = 1,
  toSeq = 2
): Promise<CoachLayoutResponse> {
  const { data } = await api.get<CoachLayoutResponse>(`/coaches/${coachId}/layout`, {
    params: {
      run_date: runDate,
      from_seq: fromSeq,
      to_seq: toSeq,
    },
  });
  return data;
}
