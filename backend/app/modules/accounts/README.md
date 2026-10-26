# G1: Accounts and access

Passengers, station staff and admins sign in with the right role, and PostgreSQL itself stops a passenger reading anyone else's rows. G1 also owns the shared `app/core` (config, connection, JWT, `require_role()`) and the platform migrations.

## Members and the SQL each one explains

| Member | Builds | SQL object |
|---|---|---|
| M1 Frontend | Sign-up, login and profile pages; saved-passenger manager (up to 10); role-aware menu | `CREATE DOMAIN` `mobile_no`, `pincode`, `email_addr` with `CHECK` rules (`0100`) |
| M2 Backend | `/auth/*`, `/me`, `/me/passengers`; bcrypt + JWT; `get_current_user`, `require_role()`; per-request `app.user_id` | Row-level security (`ENABLE ROW LEVEL SECURITY`, policies on `app_user_id()`); roles `nrrms_app` and `nrrms_report` with `GRANT`/`REVOKE` (`0102`, `0103`) |
| M3 Database | `users` (citext email, unique), `roles`, `user_roles`, `saved_passengers`, `audit_log` | `fn_audit()`: stores only the changed columns as JSONB, never a password hash (`0104`); G4, G5 and G6 attach it |

## Endpoints (`/api/v1`)

| Endpoint | Who | Notes |
|---|---|---|
| `POST /auth/signup` | anyone | Always creates a passenger |
| `POST /auth/login`, `POST /auth/refresh` | anyone / signed in | Access and refresh JWTs |
| `GET /me`, `PATCH /me` | signed in | Profile |
| `GET /me/passengers`, `POST /me/passengers`, `DELETE /me/passengers/{id}` | signed in | Saved co-travellers; the 11th is `409 PASSENGER_LIMIT` |

## Tables and migrations (`0100`-`0199`)

`0100_g1_domains.sql`, `0101_g1_accounts_schema.sql` (tables), `0102_g1_app_roles_and_session_helpers.sql` (`nrrms_app`, `nrrms_report`, `app_user_id()`, `app_user_role()`, `app_is_privileged()`, default privileges), `0103_g1_rls_and_auth_functions.sql` (policies, `auth_register()`, `auth_user_by_email()`), `0104_g1_fn_audit_diff.sql`.

Platform grants that later migrations needed: `0624` (grants on objects created before `0102`) and `0625` (takes `users.password_hash` back from `nrrms_report`).

## Tests

- `db/tests/g1_accounts.sql`: domains reject bad values; RLS as `nrrms_app` (own rows only, staff see all, anonymous sees nothing); the reporting role cannot read password hashes or write; `fn_audit()` stores only changed columns.
- `backend/tests/accounts/`, `backend/tests/test_auth.py`.
