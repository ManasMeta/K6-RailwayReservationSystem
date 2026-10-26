import { api as apiClient } from '../../../api/client';
import {
  CancelPassengersPayload,
  CancellationResponse,
  CreateReservationPayload,
  Reservation,
  ReservationListResponse,
  SavedPassenger,
} from '../types';

export const reservationsApi = {
  // Create booking hold (PENDING_PAYMENT)
  createHold: async (payload: CreateReservationPayload): Promise<Reservation> => {
    const res = await apiClient.post<Reservation>('/reservations', payload);
    return res.data;
  },

  // Get paginated list of reservations for current user
  getList: async (params?: {
    page?: number;
    page_size?: number;
    status?: string;
  }): Promise<ReservationListResponse> => {
    const res = await apiClient.get<ReservationListResponse>('/reservations', { params });
    return res.data;
  },

  // Get reservation by 10-digit PNR
  getByPnr: async (pnr: string): Promise<Reservation> => {
    const res = await apiClient.get<Reservation>(`/reservations/${pnr}`);
    return res.data;
  },

  // Cancel specific passengers
  cancelPassengers: async (
    pnr: string,
    payload: CancelPassengersPayload
  ): Promise<CancellationResponse> => {
    const res = await apiClient.post<CancellationResponse>(
      `/reservations/${pnr}/cancel`,
      payload
    );
    return res.data;
  },

  // Confirm booking payment (G5 contract hook)
  confirmHold: async (pnr: string): Promise<{ pnr: string; confirmed: boolean; status: string }> => {
    const res = await apiClient.post<{ pnr: string; confirmed: boolean; status: string }>(
      `/reservations/${pnr}/confirm`
    );
    return res.data;
  },

  // Fetch G1 Saved Passengers
  getSavedPassengers: async (): Promise<SavedPassenger[]> => {
    const res = await apiClient.get<SavedPassenger[]>('/me/passengers');
    return res.data;
  },
};
