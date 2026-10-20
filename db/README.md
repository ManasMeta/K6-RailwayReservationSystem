# G5 database notes

## Tables
- `wallets`: one INR wallet per G1 user.
- `ledger_txns`: one logical financial operation; unique reference and idempotency key prevent duplicate operations.
- `ledger_entries`: debit/credit rows; positive amounts and explicit side.
- `topups`: simulated wallet top-up requests.
- `refunds`: refund history.
- `e_tickets`: issued ticket metadata and QR payload.

## Integration blockers to resolve with G1/G4
1. Confirm G1's actual user primary key and table name.
2. Confirm G4's PNR type and reservation schema.
3. Confirm how G4 reports confirmed payment and cancellations.
4. Add a FK from `refunds.pnr` and `e_tickets.pnr` only after the shared PNR contract is agreed.

The first draft keeps PNR as `TEXT` so the module can be developed against mocks before G4's schema is merged. If the shared plan requires a direct FK, add it in a later migration once the PNR type is confirmed.
