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
    try {
      const res = await apiClient.get<SavedPassenger[]>('/me/passengers');
      return res.data;
    } catch {
      // Mock fallback data for G1 saved passengers if running standalone
      return [
        {
          passenger_id: 1,
          user_id: 1,
          full_name: 'Aarav Sharma',
          age: 29,
          gender: 'Male',
          berth_preference: 'LB',
          senior_citizen: false,
        },
        {
          passenger_id: 2,
          user_id: 1,
          full_name: 'Diya Sharma',
          age: 27,
          gender: 'Female',
          berth_preference: 'MB',
          senior_citizen: false,
        },
        {
          passenger_id: 3,
          user_id: 1,
          full_name: 'Ramesh Sharma',
          age: 64,
          gender: 'Male',
          berth_preference: 'LB',
          senior_citizen: true,
        },
        {
          passenger_id: 4,
          user_id: 1,
          full_name: 'Sunita Sharma',
          age: 61,
          gender: 'Female',
          berth_preference: 'LB',
          senior_citizen: true,
        },
      ];
    }
  },
};
