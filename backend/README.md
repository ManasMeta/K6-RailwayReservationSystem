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
| `GET /api/v1/wallet/transactions?page=&page_size=` | Statement, newest first, with `balance_after` (running balance from `v_wallet_statement`). `limit`/`offset` still work for older clients |
| `GET /api/v1/reservations/{pnr}/payment` | Fare, status and balance before paying; `404 RESERVATION_NOT_FOUND` |
| `POST /api/v1/reservations/{pnr}/pay` | Pays from the wallet through `pay_reservation()`; `402 INSUFFICIENT_FUNDS`, `404 RESERVATION_NOT_FOUND`, `409 RESERVATION_NOT_PAYABLE`; a retry returns the original payment (`replayed: true`) |
| `GET /api/v1/refunds?page=&page_size=` | Refund history |
| `GET /api/v1/tickets/{pnr}` · `.pdf` · `/qr.png` | E-ticket details, PDF (reportlab) and QR image (qrcode). Another user's PNR is `404 TICKET_NOT_FOUND` |

Authentication: `get_current_user_id` reads the signed-in user from the bearer token (or from `request.state.user_id` when trusted middleware has set it); these routes return 401 without one.

The ticket PDF shows the PNR, ticket number, fare paid, issue time and QR. Train and passenger details belong to G4 and can be added to `ticket_pdf.py` once its schema is final.

## Tests

```bash
cd backend && pytest tests -q
```
Mocked router tests always run. The integration tests run against the migrated PostgreSQL database (`DATABASE_URL`) and are skipped when it is not reachable.
