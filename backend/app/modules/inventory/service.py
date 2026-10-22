from datetime import date
from psycopg import Connection

from app.modules.inventory import schemas, sql
from app.modules.inventory.errors import InventoryError


def get_travel_classes(connection: Connection) -> list[schemas.TravelClassItem]:
    with connection.cursor() as cur:
        cur.execute(sql.GET_CLASSES)
        return [schemas.TravelClassItem(**row) for row in cur.fetchall()]


def get_quotas(connection: Connection) -> list[schemas.QuotaItem]:
    with connection.cursor() as cur:
        cur.execute(sql.GET_QUOTAS)
        return [schemas.QuotaItem(**row) for row in cur.fetchall()]


def get_availability(
    connection: Connection,
    train_no: str,
    from_code: str,
    to_code: str,
    start_date: date,
    days: int = 6,
    quota: str = "GN",
) -> schemas.AvailabilityResponse:
    if from_code.upper() == to_code.upper():
        raise InventoryError(400, "Origin and destination stations cannot be identical", "SAME_STATION")

    with connection.cursor() as cur:
        cur.execute(
            sql.AVAILABILITY_GRID,
            {
                "train_no": train_no,
                "from_code": from_code.upper(),
                "to_code": to_code.upper(),
                "start_date": start_date,
                "days": days,
                "quota": quota.upper(),
            },
        )
        rows = cur.fetchall()

        if not rows:
            # Check whether train stops even exist
            cur.execute(
                sql.RESOLVE_TRAIN_AND_STOPS,
                {
                    "train_no": train_no,
                    "from_code": from_code.upper(),
                    "to_code": to_code.upper(),
                },
            )
            stop_info = cur.fetchone()
            if not stop_info:
                raise InventoryError(
                    404,
                    f"Train {train_no} does not run between {from_code.upper()} and {to_code.upper()}",
                    "INVALID_ROUTE",
                )

        items = [schemas.AvailabilityCell(**row) for row in rows]
        return schemas.AvailabilityResponse(
            train_no=train_no,
            from_station=from_code.upper(),
            to_station=to_code.upper(),
            quota=quota.upper(),
            items=items,
        )


def calculate_fare(
    connection: Connection,
    train_no: str,
    from_code: str,
    to_code: str,
    class_code: str,
    quota_code: str = "GN",
    concession_code: str = "GENERAL",
) -> schemas.FareBreakdown:
    with connection.cursor() as cur:
        cur.execute(
            sql.RESOLVE_TRAIN_AND_STOPS,
            {
                "train_no": train_no,
                "from_code": from_code.upper(),
                "to_code": to_code.upper(),
            },
        )
        route = cur.fetchone()
        if not route:
            raise InventoryError(
                404,
                f"Train {train_no} does not service route {from_code} -> {to_code}",
                "ROUTE_NOT_FOUND",
            )

        cur.execute(
            sql.CALCULATE_FARE,
            {
                "train_id": route["train_id"],
                "from_seq": route["from_seq"],
                "to_seq": route["to_seq"],
                "class_code": class_code.upper(),
                "quota_code": quota_code.upper(),
                "concession_code": concession_code.upper(),
            },
        )
        fare_row = cur.fetchone()
        if not fare_row:
            raise InventoryError(500, "Unable to compute fare for parameters", "FARE_CALC_FAILED")

        return schemas.FareBreakdown(
            distance_km=fare_row["distance_km"],
            class_code=class_code.upper(),
            quota_code=quota_code.upper(),
            concession_code=concession_code.upper(),
            base_fare=fare_row["base"],
            reservation_fee=fare_row["reservation_fee"],
            superfast_charge=fare_row["superfast"],
            tatkal_charge=fare_row["tatkal"],
            concession_discount=fare_row["concession"],
            gst=fare_row["gst"],
            total_fare=fare_row["total"],
        )


def get_coach_layout(
    connection: Connection,
    coach_id: int,
    run_date: date,
    from_seq: int = 1,
    to_seq: int = 2,
) -> schemas.CoachLayoutResponse:
    with connection.cursor() as cur:
        cur.execute(sql.GET_COACH_BY_ID, {"coach_id": coach_id})
        coach = cur.fetchone()
        if not coach:
            raise InventoryError(404, f"Coach {coach_id} not found", "COACH_NOT_FOUND")

        cur.execute(
            sql.GET_COACH_BERTHS_WITH_STATUS,
            {
                "coach_id": coach_id,
                "run_date": run_date,
                "from_seq": from_seq,
                "to_seq": to_seq,
            },
        )
        berth_rows = cur.fetchall()

        berths = [schemas.BerthLayout(**b) for b in berth_rows]
        return schemas.CoachLayoutResponse(
            coach_id=coach["coach_id"],
            coach_code=coach["coach_code"],
            class_code=coach["class_code"],
            total_berths=coach["total_berths"],
            berths=berths,
        )


def get_train_coaches(connection: Connection, train_no: str) -> list[schemas.CoachSummary]:
    with connection.cursor() as cur:
        cur.execute("SELECT train_id FROM trains WHERE train_no = %(train_no)s", {"train_no": train_no})
        train = cur.fetchone()
        if not train:
            raise InventoryError(404, f"Train {train_no} not found", "TRAIN_NOT_FOUND")

        cur.execute(sql.GET_TRAIN_COACHES, {"train_id": train["train_id"]})
        return [schemas.CoachSummary(**c) for c in cur.fetchall()]
