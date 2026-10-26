# G5: Wallet and ticketing

Every rupee moves through a balanced ledger, a retried request never charges twice, and a paid PNR gets an e-ticket. Design notes are in [docs/g5-database-design.md](../../../../docs/g5-database-design.md); the endpoint table with error codes is in [backend/README.md](../../../README.md).

## Members and the SQL each one explains

| Member | Builds | SQL object |
|---|---|---|
| M1 Frontend | Wallet page (balance, simulated UPI top-up, statement), pay-from-wallet step, e-ticket page with QR and PDF, refund history | Statement with running balance: `SUM(amount) OVER (PARTITION BY wallet_id ORDER BY posted_at)` (`v_wallet_statement`, `0516`) |
| M2 Backend | `GET /wallet`, `POST /wallet/topups` (`Idempotency-Key`), `POST /reservations/{pnr}/pay`, `GET /tickets/{pnr}.pdf` (reportlab + qrcode), `GET /refunds` | Idempotent top-up: `UNIQUE (idempotency_key)` (`0504`) with `INSERT ... ON CONFLICT DO NOTHING RETURNING` (`service.py`) |
| M3 Database | `wallets` (`CHECK (balance >= 0)`), `ledger_txns`, `ledger_entries`, `topups`, `refunds`, `e_tickets`; the refund trigger on G4's `cancellations` | `DEFERRABLE INITIALLY DEFERRED` constraint trigger that checks each transaction sums to zero at commit (`0507`); `pay_reservation()` locks the wallet `FOR UPDATE` (`0513`); `refund_amount()` by hours before departure (`0512`) |

## Endpoints (`/api/v1`)

`GET /wallet`, `POST /wallet/topups`, `GET /wallet/transactions?page=&page_size=`, `GET /reservations/{pnr}/payment`, `POST /reservations/{pnr}/pay`, `GET /refunds?page=&page_size=`, `GET /tickets/{pnr}`, `GET /tickets/{pnr}.pdf`, `GET /tickets/{pnr}/qr.png`. The two list endpoints also accept the older `limit`/`offset`.

## Tables and migrations (`0500`-`0599`)

`0501`-`0506` tables, `0507` ledger balance trigger, `0508`/`0509` integrity fixes, `0510` payments, `0511` refund_rules, `0512` `refund_amount()`, `0513` `pay_reservation()`, `0514`/`0515`/`0518` refund on cancellation, `0516` `v_wallet_statement`, `0517` ticket numbers, `0519` RLS and audit.

## Tests

- `db/tests/g5_wallet.sql`: refund tiers, `pay_reservation()` replay and failures, the cancellation refund trigger, running balance.
- `backend/tests/test_wallet_*.py`, `backend/tests/test_ticket_pdf.py`.
