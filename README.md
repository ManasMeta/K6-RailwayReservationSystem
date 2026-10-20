# NRRMS — G5 Wallet & Ticketing starter

Group: G5  
Members: Mangesh (Frontend), Aditya (Backend), Aditya Patil (Database)  
Branch: `group/g5-wallet`

This starter implements **G5 only** and leaves contracts to G1–G4 intact. It is not the complete six-group application.

## Stack
- PostgreSQL 16
- FastAPI / Python 3.12
- React + Vite / TypeScript (frontend scaffold to be added by Mangesh)
- Docker Compose for local PostgreSQL

## Important integration assumptions
The implementation plan says G5 may depend on lower-numbered groups. These migrations assume:
- G1 provides `users(user_id)` (verify exact key name with G1 before integration).
- G4 provides `reservations(pnr, total_fare)` and `cancellations` (verify exact types/columns with G4).
- The app uses `app.user_id` or an authenticated user context for ownership checks.
Do not merge migrations until these contracts are confirmed. If parent table names/types differ, adjust the FK migration before applying it.

## Database migration order
Files in `db/migrations/0500_g5_wallet/` are numbered and must be applied in ascending order.
A migration runner is not included yet; apply files using `psql` in order for initial development.

## Local database
```powershell
docker compose up -d db
```
Then apply migrations (after G1/G4 parent tables exist):
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nrrms"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/0500_g5_wallet/0501_wallets.sql
# Continue in ascending filename order.
```

## G5 ownership
- Mangesh: wallet UI, top-up UI, payment step, ticket and refund screens.
- Aditya: FastAPI wallet endpoints and PDF/QR generation.
- Aditya Patil: SQL migrations, ledger integrity, database tests.

## Financial rules
- Use `NUMERIC(10,2)`, never float, for money.
- `ledger_entries` uses positive amounts with explicit `DEBIT` / `CREDIT` sides.
- Every posted ledger transaction must balance at commit.
- Top-ups use an idempotency key.
- Payments lock the wallet row with `SELECT ... FOR UPDATE`.
- This starter simulates top-ups; it does not call a real payment gateway.

## First push to the currently empty GitHub repository

The repository currently has no commits or branches. After extracting this starter into a local folder, run these commands from that folder (make sure the files are at the repository root):

```powershell
git init
git branch -M group/g5-wallet
git remote add origin https://github.com/ManasMeta/K6-RailwayReservationSystem.git
git add .
git commit -m "chore(g5): initialize wallet and ticketing module"
git push -u origin group/g5-wallet
```

If Git says `origin` already exists, skip `git remote add origin ...`. GitHub may require you to sign in or have write access to the repository. The connected GitHub integration in this session returned HTTP 403 when attempting to create a file, so the starter is supplied as a ZIP for a repository member with write permission to push.
