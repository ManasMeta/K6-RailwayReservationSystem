"""Service layer implementing Reservation Engine business logic."""

from decimal import Decimal
from typing import Optional

import psycopg
from fastapi import HTTPException, status

from app.core.database import db_session
from app.modules.reservations import sql
from app.modules.reservations.schemas import (
    BookingRulesResponse,
    BookingRulesUpdate,
    CancellationResponse,
    CancelledPassengerDetail,
    CancelPassengersRequest,
    PassengerResponse,
    ReservationCreate,
    ReservationListResponse,
    ReservationResponse,
)


class ReservationService:
    @staticmethod
    def create_reservation(
        payload: ReservationCreate, user_id: int, role: Optional[str] = None
    ) -> ReservationResponse:
        """Creates a booking hold (PENDING_PAYMENT), acquires transactional advisory lock,
        and invokes book_tickets() to allocate berths/RAC/WL.
        """
        with db_session(user_id=user_id, role=role) as conn:
            with conn.cursor() as cur:
                # 1. Resolve stop sequences for from and to stations
                cur.execute(
                    sql.SQL_GET_STATION_STOP_SEQS,
                    (payload.train_no, payload.from_station_code, payload.train_no, payload.to_station_code),
                )
                stop_row = cur.fetchone()
                if not stop_row or stop_row["from_seq"] is None or stop_row["to_seq"] is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "detail": f"Train {payload.train_no} does not service both stations {payload.from_station_code} and {payload.to_station_code}",
                            "code": "INVALID_STATIONS",
                        },
                    )

                from_seq = stop_row["from_seq"]
                to_seq = stop_row["to_seq"]
                if from_seq >= to_seq:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "detail": "Destination station must appear after boarding station along the train route",
                            "code": "INVALID_STATION_SEQUENCE",
                        },
                    )

                # 2. Concurrency & Locking: Acquire transactional advisory lock keyed on (train, date, class)
                # Serializes competing bookings for the same train run and class to prevent race conditions
                cur.execute(
                    sql.SQL_ACQUIRE_BOOKING_ADVISORY_LOCK,
                    (payload.train_no, str(payload.run_date), payload.class_code),
                )

                # 3. Create the Reservation record (triggers is_booking_open() BEFORE INSERT)
                try:
                    cur.execute(
                        sql.SQL_INSERT_RESERVATION,
                        (
                            user_id,
                            payload.train_no,
                            payload.run_date,
                            payload.from_station_code,
                            payload.to_station_code,
                            from_seq,
                            to_seq,
                            payload.class_code,
                            payload.quota_code,
                        ),
                    )
                    res_row = cur.fetchone()
                except psycopg.DatabaseError as exc:
                    err_msg = str(exc)
                    if "exceeds the" in err_msg or "opens at" in err_msg or "in the past" in err_msg:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={"detail": err_msg.strip(), "code": "BOOKING_WINDOW_CLOSED"},
                        )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={"detail": f"Reservation failed: {err_msg}", "code": "BOOKING_FAILED"},
                    )

                res_id = res_row["reservation_id"]
                pnr = res_row["pnr"]

                # 4. Insert passengers
                for p in payload.passengers:
                    cur.execute(
                        sql.SQL_INSERT_PASSENGER,
                        (
                            res_id,
                            p.passenger_name,
                            p.age,
                            p.gender,
                            p.berth_preference,
                            p.senior_citizen,
                        ),
                    )

                # 5. Call book_tickets() procedure
                cur.execute(sql.SQL_CALL_BOOK_TICKETS, (res_id,))

                # 6. Fetch final assigned reservation and passenger details
                cur.execute(sql.SQL_GET_RESERVATION_BY_PNR, (pnr,))
                updated_res = cur.fetchone()

                cur.execute(sql.SQL_GET_PASSENGERS_BY_RES_ID, (res_id,))
                passengers_data = cur.fetchall()

                return ReservationResponse(
                    **dict(updated_res),
                    passengers=[PassengerResponse(**dict(p)) for p in passengers_data],
                )

    @staticmethod
    def get_reservation_by_pnr(
        pnr: str, user_id: Optional[int] = None, role: Optional[str] = None
    ) -> ReservationResponse:
        """Retrieves complete reservation details and passenger allocations by 10-digit PNR."""
        with db_session(user_id=user_id, role=role) as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL_GET_RESERVATION_BY_PNR, (pnr,))
                res_row = cur.fetchone()
                if not res_row:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail={"detail": f"Reservation with PNR {pnr} not found", "code": "PNR_NOT_FOUND"},
                    )

                if user_id is not None and res_row["user_id"] != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={"detail": "You do not have permission to view this reservation", "code": "FORBIDDEN"},
                    )

                cur.execute(sql.SQL_GET_PASSENGERS_BY_RES_ID, (res_row["reservation_id"],))
                passengers_data = cur.fetchall()

                return ReservationResponse(
                    **dict(res_row),
                    passengers=[PassengerResponse(**dict(p)) for p in passengers_data],
                )

    @staticmethod
    def list_reservations(
        user_id: int,
        page: int = 1,
        page_size: int = 10,
        status_filter: Optional[str] = None,
        role: Optional[str] = None,
    ) -> ReservationListResponse:
        """Lists reservations for the logged-in passenger with pagination."""
        offset = (page - 1) * page_size
        with db_session(user_id=user_id, role=role) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL_COUNT_USER_RESERVATIONS,
                    (user_id, user_id, status_filter, status_filter),
                )
                total = cur.fetchone()["count"]

                cur.execute(
                    sql.SQL_LIST_USER_RESERVATIONS,
                    (user_id, user_id, status_filter, status_filter, page_size, offset),
                )
                rows = cur.fetchall()

                items = []
                for r in rows:
                    cur.execute(sql.SQL_GET_PASSENGERS_BY_RES_ID, (r["reservation_id"],))
                    passengers_data = cur.fetchall()
                    items.append(
                        ReservationResponse(
                            **dict(r),
                            passengers=[PassengerResponse(**dict(p)) for p in passengers_data],
                        )
                    )

                return ReservationListResponse(
                    items=items,
                    total=total,
                    page=page,
                    page_size=page_size,
                )

    @staticmethod
    def cancel_passengers(
        pnr: str,
        payload: CancelPassengersRequest,
        user_id: int,
        role: Optional[str] = None,
    ) -> CancellationResponse:
        """Cancels specific passengers on a reservation, releases berths, promotes RAC/WL,
        and computes applicable refunds.
        """
        with db_session(user_id=user_id, role=role) as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL_GET_RESERVATION_BY_PNR, (pnr,))
                res_row = cur.fetchone()
                if not res_row:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail={"detail": f"Reservation with PNR {pnr} not found", "code": "PNR_NOT_FOUND"},
                    )

                if res_row["user_id"] != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={"detail": "You do not have permission to modify this reservation", "code": "FORBIDDEN"},
                    )

                cancelled_details = []
                total_refund = Decimal("0.00")

                for pass_id in payload.passenger_ids:
                    # Check passenger belongs to this reservation
                    cur.execute(
                        "SELECT passenger_id, passenger_name, current_status FROM reservation_passengers WHERE passenger_id = %s AND reservation_id = %s;",
                        (pass_id, res_row["reservation_id"]),
                    )
                    pass_check = cur.fetchone()
                    if not pass_check:
                        continue

                    if pass_check["current_status"] == "CANCELLED":
                        continue

                    # Call cancel_passenger function
                    cur.execute(sql.SQL_CANCEL_PASSENGER, (pass_id, payload.reason))
                    refund_result = cur.fetchone()
                    refund_amt = Decimal(str(refund_result["refund_amount"])) if refund_result else Decimal("0.00")
                    total_refund += refund_amt

                    # Fetch cancellation record
                    cur.execute(sql.SQL_GET_LATEST_CANCELLATION, (pass_id,))
                    canc_row = cur.fetchone()
                    cancelled_details.append(
                        CancelledPassengerDetail(
                            passenger_id=pass_id,
                            passenger_name=pass_check["passenger_name"],
                            refund_amount=refund_amt,
                            cancellation_charge=canc_row["cancellation_charge"] if canc_row else Decimal("0.00"),
                            status="CANCELLED",
                        )
                    )

                # Fetch updated status
                cur.execute("SELECT status, updated_at FROM reservations WHERE reservation_id = %s;", (res_row["reservation_id"],))
                updated_res = cur.fetchone()

                return CancellationResponse(
                    pnr=pnr,
                    reservation_status=updated_res["status"],
                    total_refund=total_refund,
                    cancelled_passengers=cancelled_details,
                    cancelled_at=updated_res["updated_at"],
                )

    @staticmethod
    def release_expired_holds() -> int:
        """Releases overdue pending holds and restores inventory."""
        with db_session(role="system") as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL_RELEASE_EXPIRED_HOLDS)
                row = cur.fetchone()
                return int(row["released_count"]) if row else 0

    @staticmethod
    def get_booking_rules() -> BookingRulesResponse:
        """Reads the booking window that is_booking_open() enforces."""
        with db_session() as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL_GET_BOOKING_RULES)
                return BookingRulesResponse(**cur.fetchone())

    @staticmethod
    def update_booking_rules(payload: BookingRulesUpdate, user_id: int, role: str) -> BookingRulesResponse:
        """Changes the booking window; row-level security refuses anyone but an admin."""
        with db_session(user_id=user_id, role=role) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL_UPDATE_BOOKING_RULES,
                    (payload.advance_days, payload.tatkal_ac_opens_at, payload.tatkal_non_ac_opens_at),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={"detail": "Only an admin can change the booking rules", "code": "PERMISSION_DENIED"},
                    )
                return BookingRulesResponse(**row)

    @staticmethod
    def confirm_reservation(pnr: str, role: Optional[str] = None) -> bool:
        """Confirms payment and locks in reservation status."""
        with db_session(role=role) as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL_CONFIRM_RESERVATION, (pnr,))
                row = cur.fetchone()
                return bool(row["confirm_reservation"]) if row else False
