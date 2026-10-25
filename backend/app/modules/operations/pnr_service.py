"""PNR status logic (G6). Public: names are masked before they leave the server."""

from app.modules.operations import pnr_sql
from app.modules.operations.errors import OperationsError


def mask_name(full_name):
    """'Pavitra Sharma' -> 'P****** S*****' (first letter of each word stays)."""
    words = (full_name or "").split()
    return " ".join(w[0] + "*" * (len(w) - 1) for w in words)


def get_pnr_status(conn, pnr):
    """Return one booking with all its passengers, or raise 404 PNR_NOT_FOUND."""
    pnr = (pnr or "").strip()
    if not (pnr.isdigit() and len(pnr) == 10):
        raise OperationsError(400, "PNR must be 10 digits", "INVALID_PNR")

    rows = conn.execute(pnr_sql.PNR_ROWS, {"pnr": pnr}).fetchall()
    if not rows:
        raise OperationsError(404, "PNR not found", "PNR_NOT_FOUND")

    first = rows[0]
    return {
        "pnr": first["pnr"],
        "reservation_status": first["reservation_status"],
        "train_no": first["train_no"],
        "train_name": first["train_name"],
        "run_date": first["run_date"],
        "from_station_code": first["from_station_code"],
        "from_station_name": first["from_station_name"],
        "to_station_code": first["to_station_code"],
        "to_station_name": first["to_station_name"],
        "class_code": first["class_code"],
        "quota_code": first["quota_code"],
        "run_status": first["run_status"],
        "delay_minutes": first["delay_minutes"],
        "chart_prepared": first["chart_prepared"],
        "passengers": [
            {
                "name": mask_name(r["passenger_name"]),
                "status": r["passenger_status"],
                "coach_code": r["coach_code"],
                "berth_no": r["berth_no"],
                "berth_type": r["berth_type"],
                "rac_number": r["rac_number"],
                "wl_number": r["wl_number"],
            }
            for r in rows
        ],
    }
