// Money arrives as decimal strings ("400.00") so it is never rounded as a float.
export interface Wallet {
  wallet_id: number;
  balance: string;
  currency: string;
}

export interface TopupResult {
  topup_id: number;
  amount: string;
  balance: string;
  status: string;
  replayed: boolean;
}

export interface StatementItem {
  ledger_txn_id: number;
  type: "TOPUP" | "PAYMENT" | "REFUND";
  reference_id: string;
  description: string;
  amount: string;
  direction: "CREDIT" | "DEBIT";
  balance_after: string;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  total: number;
}

export interface PaymentQuote {
  pnr: string;
  amount: string;
  status: string;
  balance: string;
  payable: boolean;
}

export interface PaymentResult {
  payment_id: number;
  pnr: string;
  amount: string;
  balance: string;
  ticket_number: string;
  replayed: boolean;
}

export interface Refund {
  refund_id: number;
  pnr: string;
  amount: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface TicketDetails {
  pnr: string;
  ticket_number: string;
  amount: string;
  issued_at: string;
}
