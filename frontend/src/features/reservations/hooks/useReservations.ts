import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../api/reservationsApi';
import { CancelPassengersPayload, CreateReservationPayload } from '../types';

export const RESERVATION_KEYS = {
  all: ['reservations'] as const,
  lists: () => [...RESERVATION_KEYS.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...RESERVATION_KEYS.lists(), params] as const,
  details: () => [...RESERVATION_KEYS.all, 'detail'] as const,
  detail: (pnr: string) => [...RESERVATION_KEYS.details(), pnr] as const,
  savedPassengers: () => ['saved_passengers'] as const,
  bookingRules: () => ['booking_rules'] as const,
};

export function useReservations(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: RESERVATION_KEYS.list(params || {}),
    queryFn: () => reservationsApi.getList(params),
  });
}

export function useReservationDetails(pnr: string, enabled: boolean = true) {
  return useQuery({
    queryKey: RESERVATION_KEYS.detail(pnr),
    queryFn: () => reservationsApi.getByPnr(pnr),
    enabled: Boolean(pnr) && enabled,
    refetchInterval: (query) => {
      // Auto-poll while hold is active
      if (query.state.data?.status === 'PENDING_PAYMENT') {
        return 10000;
      }
      return false;
    },
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReservationPayload) => reservationsApi.createHold(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.lists() });
      queryClient.setQueryData(RESERVATION_KEYS.detail(data.pnr), data);
    },
  });
}

export function useCancelPassengers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pnr, payload }: { pnr: string; payload: CancelPassengersPayload }) =>
      reservationsApi.cancelPassengers(pnr, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.detail(variables.pnr) });
    },
  });
}

export function useConfirmReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pnr: string) => reservationsApi.confirmHold(pnr),
    onSuccess: (_, pnr) => {
      queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.detail(pnr) });
    },
  });
}

export function useSavedPassengers() {
  return useQuery({
    queryKey: RESERVATION_KEYS.savedPassengers(),
    queryFn: () => reservationsApi.getSavedPassengers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBookingRules(enabled: boolean = true) {
  return useQuery({
    queryKey: RESERVATION_KEYS.bookingRules(),
    queryFn: () => reservationsApi.getBookingRules(),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
