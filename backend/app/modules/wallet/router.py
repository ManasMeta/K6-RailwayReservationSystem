from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from decimal import Decimal

router = APIRouter(tags=["G5 Wallet & Ticketing"])

class TopUpRequest(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

@router.get("/wallet")
def get_wallet() -> dict:
    # TODO Aditya: use authenticated user context and parameterised PostgreSQL query.
    raise HTTPException(status_code=501, detail="Wallet persistence is not connected yet")

@router.post("/wallet/topups", status_code=501)
def create_topup(payload: TopUpRequest) -> dict:
    # TODO: require Idempotency-Key header, lock wallet row, create balanced ledger entries.
    raise HTTPException(status_code=501, detail="Top-up service is not connected yet")

@router.post("/reservations/{pnr}/pay", status_code=501)
def pay_reservation(pnr: str) -> dict:
    # TODO: integrate with G4 confirm_reservation(pnr) contract.
    raise HTTPException(status_code=501, detail="Payment service is not connected yet")

@router.get("/tickets/{pnr}.pdf", status_code=501)
def download_ticket(pnr: str) -> dict:
    # TODO: verify ownership and issue PDF/QR ticket for a paid reservation.
    raise HTTPException(status_code=501, detail="Ticket generation is not connected yet")

@router.get("/refunds", status_code=501)
def list_refunds() -> dict:
    # TODO: list refunds belonging to the authenticated user only.
    raise HTTPException(status_code=501, detail="Refund service is not connected yet")
