from decimal import Decimal
from typing import Annotated

import psycopg
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Path,
    Query,
    Response,
    status,
)
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id
from app.core.database import get_db_connection
from app.modules.wallet.errors import WalletError
from app.modules.wallet.service import (
    IdempotencyConflict,
    InsufficientFunds,
    ReservationNotFound,
    ReservationNotPayable,
    TicketNotFound,
    create_mock_topup,
    get_or_create_wallet,
    get_payment_quote,
    get_refunds,
    get_ticket,
    get_wallet_transactions,
    pay_reservation,
)
from app.modules.wallet.ticket_pdf import render_qr_png, render_ticket_pdf

router = APIRouter(tags=["Wallet"])

PNR = Path(pattern=r"^[A-Za-z0-9]{1,20}$", description="Reservation PNR")
UserId = Annotated[int, Depends(get_current_user_id)]
Db = Annotated[Connection, Depends(get_db_connection)]


class TopupRequest(BaseModel):
    amount: Decimal = Field(gt=Decimal(0), max_digits=10, decimal_places=2)
    # Prefer the Idempotency-Key header; the body field is kept for older clients.
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


@router.get("/wallet")
def get_wallet(user_id: UserId, connection: Db) -> dict:
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
    user_id: UserId,
    connection: Db,
    idempotency_key_header: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=128)
    ] = None,
) -> dict:
    key = idempotency_key_header or payload.idempotency_key
    if key is None:
        raise HTTPException(422, "An Idempotency-Key header is required")
    try:
        result = create_mock_topup(connection, user_id, payload.amount, key)
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


@router.get("/wallet/transactions")
def get_transactions(
    user_id: UserId,
    connection: Db,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
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


def _unavailable(connection: Connection, exc: Exception) -> WalletError:
    connection.rollback()
    return WalletError(
        503, "Wallet database is unavailable or its schema is not ready", "DB_UNAVAILABLE"
    )


@router.get("/reservations/{pnr}/payment")
def payment_quote(pnr: Annotated[str, PNR], user_id: UserId, connection: Db) -> dict:
    """Fare, status and wallet balance, so the pay screen can show what will be charged."""
    try:
        return get_payment_quote(connection, user_id, pnr)
    except ReservationNotFound as exc:
        raise WalletError(404, str(exc), "RESERVATION_NOT_FOUND") from exc
    except psycopg.Error as exc:
        raise _unavailable(connection, exc) from exc


@router.post("/reservations/{pnr}/pay")
def pay_from_wallet(
    pnr: Annotated[str, PNR],
    user_id: UserId,
    connection: Db,
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=128)
    ] = None,
) -> dict:
    """Pay a held reservation from the wallet. A retry returns the original payment."""
    try:
        result = pay_reservation(connection, user_id, pnr, idempotency_key)
        connection.commit()
        return result
    except ReservationNotFound as exc:
        connection.rollback()
        raise WalletError(404, str(exc), "RESERVATION_NOT_FOUND") from exc
    except ReservationNotPayable as exc:
        connection.rollback()
        raise WalletError(409, str(exc), "RESERVATION_NOT_PAYABLE") from exc
    except InsufficientFunds as exc:
        connection.rollback()
        raise WalletError(402, str(exc), "INSUFFICIENT_FUNDS") from exc
    except UniqueViolation as exc:
        connection.rollback()
        raise WalletError(
            409, "Idempotency key was already used for another payment", "IDEMPOTENCY_CONFLICT"
        ) from exc
    except psycopg.Error as exc:
        raise _unavailable(connection, exc) from exc


@router.get("/refunds")
def list_refunds(
    user_id: UserId,
    connection: Db,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    try:
        return get_refunds(connection, user_id, limit=limit, offset=offset)
    except psycopg.Error as exc:
        raise _unavailable(connection, exc) from exc


def _ticket_or_404(connection: Connection, user_id: int, pnr: str) -> dict:
    try:
        return get_ticket(connection, user_id, pnr)
    except TicketNotFound as exc:
        raise WalletError(404, str(exc), "TICKET_NOT_FOUND") from exc
    except psycopg.Error as exc:
        raise _unavailable(connection, exc) from exc


# The .pdf and /qr.png routes are declared before /tickets/{pnr} so they win the match.
@router.get("/tickets/{pnr}.pdf")
def download_ticket_pdf(pnr: Annotated[str, PNR], user_id: UserId, connection: Db) -> Response:
    ticket = _ticket_or_404(connection, user_id, pnr)
    return Response(
        content=render_ticket_pdf(ticket),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ticket-{ticket["pnr"]}.pdf"'},
    )


@router.get("/tickets/{pnr}/qr.png")
def ticket_qr(pnr: Annotated[str, PNR], user_id: UserId, connection: Db) -> Response:
    ticket = _ticket_or_404(connection, user_id, pnr)
    return Response(content=render_qr_png(ticket["qr_payload"]), media_type="image/png")


@router.get("/tickets/{pnr}")
def get_ticket_details(pnr: Annotated[str, PNR], user_id: UserId, connection: Db) -> dict:
    ticket = _ticket_or_404(connection, user_id, pnr)
    return {
        "pnr": ticket["pnr"],
        "ticket_number": ticket["ticket_number"],
        "amount": ticket["amount"],
        "issued_at": ticket["issued_at"],
    }
