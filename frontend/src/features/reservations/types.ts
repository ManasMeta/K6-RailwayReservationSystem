export type QuotaCode = 'GN' | 'TQ' | 'PT' | 'LD' | 'SS';

export type BerthPreference = 'LB' | 'MB' | 'UB' | 'SL' | 'SU' | 'WS';

export type ReservationStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PARTIALLY_CANCELLED';

export interface Passenger {
  passenger_id?: number;
  reservation_id?: number;
  passenger_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Transgender' | string;
  berth_preference?: string | null;
  senior_citizen: boolean;
  booking_status?: string;
  current_status?: string;
  coach_code?: string | null;
  berth_number?: number | null;
  berth_type?: string | null;
  rac_number?: number | null;
  wl_number?: number | null;
  fare?: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface Reservation {
  reservation_id: number;
  pnr: string;
  user_id: number;
  train_no: string;
  train_name?: string;
  run_date: string;
  from_station_code: string;
  to_station_code: string;
  from_seq: number;
  to_seq: number;
  class_code: string;
  quota_code: QuotaCode | string;
  status: ReservationStatus;
  total_fare: string | number;
  hold_expires_at: string;
  passengers: Passenger[];
  created_at: string;
  updated_at: string;
}

export interface CreateReservationPayload {
  train_no: string;
  run_date: string;
  from_station_code: string;
  to_station_code: string;
  class_code: string;
  quota_code: string;
  passengers: {
    passenger_name: string;
    age: number;
    gender: string;
    berth_preference?: string | null;
    senior_citizen?: boolean;
  }[];
}

export interface CancelPassengersPayload {
  passenger_ids: number[];
  reason?: string;
}

export interface CancelledPassengerItem {
  passenger_id: number;
  passenger_name: string;
  refund_amount: string | number;
  cancellation_charge: string | number;
  status: string;
}

export interface CancellationResponse {
  pnr: string;
  reservation_status: string;
  total_refund: string | number;
  cancelled_passengers: CancelledPassengerItem[];
  cancelled_at: string;
}

export interface ReservationListResponse {
  items: Reservation[];
  total: number;
  page: number;
  page_size: number;
}

export interface SavedPassenger {
  passenger_id: number;
  user_id: number;
  full_name: string;
  age: number;
  gender: string;
  berth_preference?: string;
  senior_citizen: boolean;
}

/** The configurable booking window from GET /reservations/booking-rules (times are IST, HH:MM:SS). */
export interface BookingRules {
  advance_days: number;
  tatkal_ac_opens_at: string;
  tatkal_non_ac_opens_at: string;
  updated_at: string;
}
