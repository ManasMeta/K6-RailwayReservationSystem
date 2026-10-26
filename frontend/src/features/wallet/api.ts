import axios from "axios";
import { api } from "../../api/client";
import type {
  Page,
  PaymentQuote,
  PaymentResult,
  Refund,
  StatementItem,
  TicketDetails,
  TopupResult,
  Wallet,
} from "./types";

/** `code` from the {"detail", "code"} error body, if the server sent one. */
export function errorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? error.response?.data?.code : undefined;
}

export async function getWallet(): Promise<Wallet> {
  return (await api.get<Wallet>("/wallet")).data;
}

/** The Idempotency-Key makes a retried top-up credit the wallet only once. */
export async function topUp(amount: string, idempotencyKey: string): Promise<TopupResult> {
  const { data } = await api.post<TopupResult>(
    "/wallet/topups",
    { amount },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

/** The API's list convention is page/page_size; the pages keep an offset, so convert here. */
function pageParams(limit: number, offset: number) {
  return { page: Math.floor(offset / limit) + 1, page_size: limit };
}

export async function getStatement(limit: number, offset: number): Promise<Page<StatementItem>> {
  return (await api.get<Page<StatementItem>>("/wallet/transactions", { params: pageParams(limit, offset) }))
    .data;
}

export async function getQuote(pnr: string): Promise<PaymentQuote> {
  return (await api.get<PaymentQuote>(`/reservations/${encodeURIComponent(pnr)}/payment`)).data;
}

export async function payReservation(pnr: string, idempotencyKey: string): Promise<PaymentResult> {
  const { data } = await api.post<PaymentResult>(
    `/reservations/${encodeURIComponent(pnr)}/pay`,
    undefined,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function getRefunds(limit: number, offset: number): Promise<Page<Refund>> {
  return (await api.get<Page<Refund>>("/refunds", { params: pageParams(limit, offset) })).data;
}

export async function getTicket(pnr: string): Promise<TicketDetails> {
  return (await api.get<TicketDetails>(`/tickets/${encodeURIComponent(pnr)}`)).data;
}

// Images and downloads need the bearer token, so they are fetched as blobs.
export async function getTicketQr(pnr: string): Promise<Blob> {
  return (
    await api.get<Blob>(`/tickets/${encodeURIComponent(pnr)}/qr.png`, { responseType: "blob" })
  ).data;
}

export async function getTicketPdf(pnr: string): Promise<Blob> {
  return (
    await api.get<Blob>(`/tickets/${encodeURIComponent(pnr)}.pdf`, { responseType: "blob" })
  ).data;
}
