from fastapi import FastAPI
from app.modules.wallet.router import router as wallet_router

app = FastAPI(title="NRRMS G5 Wallet & Ticketing", version="0.1.0")
app.include_router(wallet_router, prefix="/api/v1")

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
