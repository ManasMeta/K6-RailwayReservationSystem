export interface AvailabilityCell {
  travel_date: string;
  class_code: string;
  class_name: string;
  status: "AVAILABLE" | "RAC" | "WL" | string;
  available_count: number;
  rac_count: number;
  wl_count: number;
  fare: number;
}

export interface AvailabilityResponse {
  train_no: string;
  from_station: string;
  to_station: string;
  quota: string;
  items: AvailabilityCell[];
}

export interface FareBreakdown {
  distance_km: number;
  class_code: string;
  quota_code: string;
  concession_code: string;
  base_fare: number;
  reservation_fee: number;
  superfast_charge: number;
  tatkal_charge: number;
  concession_discount: number;
  gst: number;
  total_fare: number;
}

export interface BerthLayout {
  berth_id: number;
  berth_number: number;
  berth_type: string;
  is_available: boolean;
}

export interface CoachLayoutResponse {
  coach_id: number;
  coach_code: string;
  class_code: string;
  total_berths: number;
  berths: BerthLayout[];
}

export interface CoachSummary {
  coach_id: number;
  coach_code: string;
  class_code: string;
  total_berths: number;
}
