# Backend

Run from the repository root after installing `backend/requirements.txt`:
```bash
uvicorn app.main:app --app-dir backend --reload
```
Open `/docs` for the API contract. Errors from payment, refund and ticket routes are `{"detail": "...", "code": "..."}`.

## G5 wallet and ticketing (`app/modules/wallet/`)

| Endpoint | Notes |
|---|---|
| `GET /api/v1/wallet` | Balance (creates the wallet on first use) |
| `POST /api/v1/wallet/topups` | Simulated UPI top-up. `Idempotency-Key` header (body `idempotency_key` still accepted); a retry replays the first result, a reused key with another amount is `409` |
| `GET /api/v1/wallet/transactions?limit=&offset=` | Statement, newest first, with `balance_after` (running balance from `v_wallet_statement`) |
| `GET /api/v1/reservations/{pnr}/payment` | Fare, status and balance before paying; `404 RESERVATION_NOT_FOUND` |
| `POST /api/v1/reservations/{pnr}/pay` | Pays from the wallet through `pay_reservation()`; `402 INSUFFICIENT_FUNDS`, `404 RESERVATION_NOT_FOUND`, `409 RESERVATION_NOT_PAYABLE`; a retry returns the original payment (`replayed: true`) |
| `GET /api/v1/refunds` | Refund history |
| `GET /api/v1/tickets/{pnr}` · `.pdf` · `/qr.png` | E-ticket details, PDF (reportlab) and QR image (qrcode). Another user's PNR is `404 TICKET_NOT_FOUND` |

Authentication comes from `get_current_user_id` (G1 sets `request.state.user_id`); until G1's JWT middleware is merged these routes return 401.

The ticket PDF shows the PNR, ticket number, fare paid, issue time and QR. Train and passenger details belong to G4 and can be added to `ticket_pdf.py` once its schema is final.

## Tests

```bash
cd backend && pytest tests -q
```
Mocked router tests always run. The integration tests run against PostgreSQL 16 in the `g5_migration_check` schema (G5 migrations plus `db/tests/support/g5_contract_stubs.sql`) and are skipped when it is missing.
