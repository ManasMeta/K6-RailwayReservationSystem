# G5 backend

Run from the repository root after installing `backend/requirements.txt`:
```bash
uvicorn app.main:app --app-dir backend --reload
```
Open `/docs` for the API contract. Routes are scaffolds and return HTTP 501 until connected to PostgreSQL and authentication. Do not present them as completed business logic.
