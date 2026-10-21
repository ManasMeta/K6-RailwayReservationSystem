# SQL tests

`g5_wallet.sql` - refund tiers, `pay_reservation()`, the cancellation refund trigger and the running-balance statement. Needs G1 `users` and G4 `reservations`/`cancellations`/`confirm_reservation`, or `support/g5_contract_stubs.sql` as stand-ins:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/support/g5_contract_stubs.sql   # only without G1/G4
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g5_wallet.sql
```

Still to add for G5 when G1's row-level security lands: one user cannot read another user's wallet, tickets or refunds.
