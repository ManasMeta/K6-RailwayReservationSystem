import psycopg
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation

from app.core.auth import get_current_user_id
from app.core.database import get_db_connection
from app.modules.wallet.service import (
    IdempotencyConflict,
    create_mock_topup,
    get_or_create_wallet,
    get_wallet_transactions,
)

router = APIRouter(tags=["Wallet"])


class TopupRequest(BaseModel):
    amount: Decimal = Field(gt=Decimal("0"), max_digits=10, decimal_places=2)
    idempotency_key: str = Field(min_length=8, max_length=128)


@router.get("/wallet")
def get_wallet(
    user_id: int = Depends(get_current_user_id),
    connection: Connection = Depends(get_db_connection),
) -> dict:
    try:
        wallet = get_or_create_wallet(connection, user_id)
        connection.commit()
        return wallet
    except ForeignKeyViolation as exc:
        connection.rollback()
        raise HTTPException(404, "User account was not found") from exc
    except RuntimeError as exc:
        connection.rollback()
        raise HTTPException(503, "Wallet could not be initialized") from exc
    except psycopg.Error as exc:
        connection.rollback()
        raise HTTPException(
            503, "Wallet database is unavailable or its schema is not ready"
        ) from exc


@router.post("/wallet/topups", status_code=status.HTTP_201_CREATED)
def create_topup(
    payload: TopupRequest,
    user_id: int = Depends(get_current_user_id),
    connection: Connection = Depends(get_db_connection),
) -> dict:
    try:
        result = create_mock_topup(
            connection,
            user_id,
            payload.amount,
            payload.idempotency_key,
        )
        connection.commit()
        return result
    except IdempotencyConflict as exc:
        connection.rollback()
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        connection.rollback()
        raise HTTPException(422, str(exc)) from exc
    except RuntimeError as exc:
        connection.rollback()
        raise HTTPException(503, "Wallet could not be initialized") from exc
    except psycopg.Error as exc:
        connection.rollback()
        raise HTTPException(503, "Top-up could not be completed") from exc


@router.post("/wallet/payments", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def pay_for_reservation() -> dict:
    raise HTTPException(501, "Reservation payments are not implemented yet")


@router.get("/wallet/transactions")
def get_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: int = Depends(get_current_user_id),
    connection: Connection = Depends(get_db_connection),
) -> dict:
    try:
        return get_wallet_transactions(
            connection, user_id, limit=limit, offset=offset
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except psycopg.Error as exc:
        connection.rollback()
        raise HTTPException(
            503, "Transaction history is unavailable"
        ) from exc
