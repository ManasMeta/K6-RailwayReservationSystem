"""FastAPI Router for Reservation Engine endpoints (/api/v1/reservations)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.auth import UserPayload, get_current_user, require_role
from app.modules.reservations.schemas import (
    CancellationResponse,
    CancelPassengersRequest,
    ReservationCreate,
    ReservationListResponse,
    ReservationResponse,
)
from app.modules.reservations.service import ReservationService

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.post(
    "",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new reservation hold (PENDING_PAYMENT)",
    description=(
        "Locks seats and creates a 10-minute hold as PENDING_PAYMENT. "
        "Allocates preferred berths, falling back to next available berth, then RAC, then WL."
    ),
)
def create_reservation(
    payload: ReservationCreate,
    current_user: UserPayload = Depends(get_current_user),
) -> ReservationResponse:
    return ReservationService.create_reservation(payload, user_id=current_user.user_id, role=current_user.role)


@router.get(
    "",
    response_model=ReservationListResponse,
    summary="List current user's reservations",
    description="Returns a paginated list of reservations for the logged-in passenger.",
)
def list_reservations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Optional status filter"),
    current_user: UserPayload = Depends(get_current_user),
) -> ReservationListResponse:
    return ReservationService.list_reservations(
        user_id=current_user.user_id,
        role=current_user.role,
        page=page,
        page_size=page_size,
        status_filter=status,
    )


@router.get(
    "/{pnr}",
    response_model=ReservationResponse,
    summary="Get reservation details by 10-digit PNR",
    description="Fetches detailed booking, coach, berth, RAC, or WL allocation for a PNR.",
)
def get_reservation(
    pnr: str,
    current_user: UserPayload = Depends(get_current_user),
) -> ReservationResponse:
    return ReservationService.get_reservation_by_pnr(pnr=pnr, user_id=current_user.user_id, role=current_user.role)


@router.post(
    "/{pnr}/cancel",
    response_model=CancellationResponse,
    summary="Cancel reservation passengers",
    description=(
        "Cancels one or more selected passengers on a reservation. Frees the allocated berth range, "
        "promotes RAC to confirmed (CNF) and WL to RAC, and calculates the refund."
    ),
)
def cancel_passengers(
    pnr: str,
    payload: CancelPassengersRequest,
    current_user: UserPayload = Depends(get_current_user),
) -> CancellationResponse:
    return ReservationService.cancel_passengers(
        pnr=pnr, payload=payload, user_id=current_user.user_id, role=current_user.role
    )


@router.post(
    "/{pnr}/confirm",
    summary="Confirm reservation after successful payment",
    description=(
        "Staff/admin override that marks a reservation as CONFIRMED without a wallet payment. "
        "Passengers pay through POST /reservations/{pnr}/pay, which confirms in the database."
    ),
)
def confirm_reservation(
    pnr: str,
    current_user: UserPayload = Depends(require_role(["staff", "admin"])),
) -> dict:
    success = ReservationService.confirm_reservation(pnr=pnr, role=current_user.role)
    return {"pnr": pnr, "confirmed": success, "status": "CONFIRMED"}


@router.post(
    "/admin/release-expired-holds",
    summary="Release expired reservation holds",
    description="Scheduled background job trigger to release berths from holds exceeding 10 minutes.",
)
def release_expired_holds(
    current_user: UserPayload = Depends(require_role(["staff", "admin"])),
) -> dict:
    released = ReservationService.release_expired_holds()
    return {"released_count": released, "message": f"Successfully released {released} expired holds"}
