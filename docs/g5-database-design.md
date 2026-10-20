# G5 Wallet & Ticketing — database design

## Scope
This schema covers only G5's wallet, financial ledger, top-ups, refunds, and e-ticket metadata. G1 owns identity/accounts; G4 owns reservations and cancellations.

## Logical relationships

```mermaid
erDiagram
    USERS ||--|| WALLETS : owns
    WALLETS ||--o{ TOPUPS : receives
    WALLETS ||--o{ REFUNDS : receives
    LEDGER_TXNS ||--|{ LEDGER_ENTRIES : contains
    LEDGER_TXNS ||--o| TOPUPS : records
    LEDGER_TXNS ||--o| REFUNDS : records
    RESERVATIONS ||--o| E_TICKETS : issues
```

The diagram is a logical contract, not a guarantee that the upstream `users` and `reservations` table names/keys are already available. Confirm their exact definitions with G1 and G4 before applying the migrations.

## Table intent

| Table | Key constraints | Why it exists |
|---|---|---|
| `wallets` | One wallet per `user_id`; balance must be nonnegative | Current spendable balance |
| `ledger_txns` | Unique idempotency key and unique business reference | One logical financial event |
| `ledger_entries` | Positive amount; debit/credit side; transaction FK | Auditable double-entry accounting |
| `topups` | Unique idempotency key; positive amount | Records simulated wallet funding |
| `refunds` | Positive amount; unique business rule key | Refund history |
| `e_tickets` | Unique PNR and ticket number | Ticket metadata and QR payload |

## Double-entry convention

Amounts are always positive. The direction is stored in `entry_side` (`DEBIT` or `CREDIT`). For every posted logical transaction, total debits must equal total credits. The deferred constraint trigger validates the complete set at transaction commit, allowing the two sides to be inserted within one SQL transaction.

Example for a simulated top-up of ₹500:
- `RAILWAY_CLEARING` — DEBIT ₹500
- `CUSTOMER_WALLET` — CREDIT ₹500

Example for a wallet-funded ticket payment of ₹500:
- `CUSTOMER_WALLET` — DEBIT ₹500
- `RAILWAY_CLEARING` — CREDIT ₹500

The `wallets.balance` field is a cached current balance for fast reads. Every balance update must be performed in the same database transaction as the matching ledger entries.

## Concurrency and idempotency requirements

1. Lock a wallet row using `SELECT ... FOR UPDATE` before changing its balance.
2. Use the client-provided `Idempotency-Key` for top-up requests and enforce uniqueness in the database.
3. Perform balance check, balance update, ledger transaction, and ledger entries in one database transaction.
4. A retry with the same idempotency key must return the original result rather than apply the amount twice.
5. Do not treat HTTP 501 scaffold endpoints as implemented financial operations.

## Integration checklist
- [ ] Confirm G1 `users` primary key and RLS/session conventions.
- [ ] Confirm G4 PNR type, reservation table and `total_fare` type.
- [ ] Agree how G4 confirms a reservation after successful payment.
- [ ] Agree how G4 cancellation triggers a refund request.
- [ ] Add cross-module foreign keys in a new migration after the shared contracts are stable.
- [ ] Add SQL tests for balanced ledger, insufficient funds, duplicate idempotency key and transaction rollback.
