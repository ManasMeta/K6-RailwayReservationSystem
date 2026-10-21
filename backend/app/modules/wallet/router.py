from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id

router = APIRouter(tags=["G5 Wallet & Ticketing"])


class TopUpRequest(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


@router.get("/wallet")
def get_wallet(
    user_id: int = Depends(get_current_user_id),
) -> dict:
    # Persistence will be connected after the shared schema is confirmed.
    raise HTTPException(
        status_code=501,
        detail="Wallet persistence is not connected yet",
    )


@router.post("/wallet/topups", status_code=501)
def create_topup(payload: TopUpRequest) -> dict:
    raise HTTPException(
        status_code=501,
        detail="Top-up service is not connected yet",
    )


@router.post("/reservations/{pnr}/pay", status_code=501)
def pay_reservation(pnr: str) -> dict:
    raise HTTPException(
        status_code=501,
        detail="Payment service is not connected yet",
    )


@router.get("/tickets/{pnr}.pdf", status_code=501)
def download_ticket(pnr: str) -> dict:
    raise HTTPException(
        status_code=501,
        detail="Ticket generation is not connected yet",
    )


@router.get("/refunds", status_code=501)
def list_refunds() -> dict:
    raise HTTPException(
        status_code=501,
        detail="Refund service is not connected yet",
    )
