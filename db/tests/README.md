# G5 SQL tests

Before writing executable SQL assertions, confirm the G1 `users` table contract and G4 reservation/PNR contract. Required cases:
- wallet balance cannot become negative
- ledger entries cannot commit unbalanced
- duplicate top-up idempotency key is rejected/no-op
- a wallet cannot be charged twice by concurrent payment requests
- refund creation is idempotent
- one user cannot retrieve another user's wallet, tickets, or refunds
