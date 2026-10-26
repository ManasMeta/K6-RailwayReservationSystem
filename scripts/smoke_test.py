#!/usr/bin/env python3
"""End-to-end smoke test against a running API. Exits non-zero on the first failed check.

    python scripts/smoke_test.py http://127.0.0.1:8000

Needs a migrated database with the sample timetable (train 12301, HWH -> NDLS) and generated
coaches. CI runs it with the API connected as the restricted nrrms_app role, so it also proves
that row-level security does not break the real flows.
"""
import datetime as dt
import sys
import time

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
client = httpx.Client(base_url=BASE, timeout=60)
STAMP = str(int(time.time()))


def check(condition, label, response=None):
    if condition:
        print(f"ok    {label}")
        return
    detail = f" -> {response.status_code} {response.text[:300]}" if response is not None else ""
    print(f"FAIL  {label}{detail}")
    sys.exit(1)


def signup(name):
    r = client.post(
        "/auth/signup",
        json={"email": f"{name}{STAMP}@example.com", "password": "smoke-test-pass", "full_name": name.title()},
    )
    check(r.status_code == 201, f"sign up {name}", r)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main():
    ana = signup("ana")
    ben = signup("ben")

    r = client.post("/auth/signup", json={"email": f"ana{STAMP}@example.com", "password": "smoke-test-pass", "full_name": "Dup"})
    check(r.status_code == 409 and r.json()["code"] == "EMAIL_TAKEN", "duplicate email is refused", r)
    r = client.post("/auth/login", json={"email": f"ana{STAMP}@example.com", "password": "wrong-password"})
    check(r.status_code == 401, "wrong password is refused", r)
    r = client.get("/me", headers=ana)
    check(r.status_code == 200 and r.json()["role"] == "passenger", "GET /me", r)
    check(client.get("/me").status_code == 401, "GET /me without a token is 401")

    r = client.post("/me/passengers", headers=ana, json={"full_name": "Asha Rao", "age": 31, "gender": "Female"})
    check(r.status_code == 201, "save a passenger", r)

    day = (dt.date.today() + dt.timedelta(days=5)).isoformat()
    r = client.get("/journeys", params={"from": "HWH", "to": "NDLS", "date": day})
    check(r.status_code == 200 and r.json()["direct"], "journey search finds a direct train", r)

    booking = {
        "train_no": "12301", "run_date": day, "from_station_code": "HWH", "to_station_code": "NDLS",
        "class_code": "3A", "quota_code": "GN",
        "passengers": [
            {"passenger_name": "Asha Rao", "age": 31, "gender": "Female", "berth_preference": "LB"},
            {"passenger_name": "Ravi Rao", "age": 62, "gender": "Male", "berth_preference": "UB"},
        ],
    }
    r = client.post("/reservations", headers=ana, json=booking)
    check(r.status_code == 201 and r.json()["status"] == "PENDING_PAYMENT", "book two passengers", r)
    pnr = r.json()["pnr"]
    fare = r.json()["total_fare"]
    check(float(fare) > 0, f"booking has a fare ({fare})")
    check(all(p["current_status"] == "CNF" for p in r.json()["passengers"]), "both passengers got a confirmed berth")

    check(client.get(f"/reservations/{pnr}", headers=ben).status_code == 404, "another user cannot read the booking")
    r = client.get("/reservations", headers=ben)
    check(r.status_code == 200 and r.json()["total"] == 0, "another user's list is empty", r)
    check(client.post(f"/reservations/{pnr}/confirm", headers=ana).status_code == 403, "a passenger cannot confirm unpaid")
    check(client.get(f"/pnr/{pnr}").status_code == 200, "public PNR status works without login")

    r = client.post(f"/reservations/{pnr}/pay", headers={**ana, "Idempotency-Key": f"pay-a-{STAMP}"})
    check(r.status_code == 402, "paying with an empty wallet is 402", r)
    r = client.post("/wallet/topups", headers={**ana, "Idempotency-Key": f"top-a-{STAMP}"}, json={"amount": "20000.00"})
    check(r.status_code == 201, "top up the wallet", r)
    r = client.post(f"/reservations/{pnr}/pay", headers={**ben, "Idempotency-Key": f"pay-b-{STAMP}"})
    check(r.status_code == 404, "another user cannot pay the booking", r)
    r = client.post(f"/reservations/{pnr}/pay", headers={**ana, "Idempotency-Key": f"pay-a2-{STAMP}"})
    check(r.status_code == 200 and not r.json()["replayed"], "pay from the wallet", r)
    r = client.post(f"/reservations/{pnr}/pay", headers={**ana, "Idempotency-Key": f"pay-a2-{STAMP}"})
    check(r.status_code == 200 and r.json()["replayed"], "a retried payment is replayed, not charged twice", r)
    r = client.get(f"/reservations/{pnr}", headers=ana)
    check(r.json()["status"] == "CONFIRMED", "reservation is CONFIRMED after payment", r)
    r = client.get(f"/tickets/{pnr}.pdf", headers=ana)
    check(r.status_code == 200 and r.content.startswith(b"%PDF"), "e-ticket PDF downloads", r)

    balance_before = float(client.get("/wallet", headers=ana).json()["balance"])
    ids = [p["passenger_id"] for p in client.get(f"/reservations/{pnr}", headers=ana).json()["passengers"]]
    r = client.post(f"/reservations/{pnr}/cancel", headers=ana, json={"passenger_ids": [ids[0]], "reason": "smoke"})
    check(r.status_code == 200 and float(r.json()["total_refund"]) > 0, "cancelling a passenger refunds", r)
    refunded = float(r.json()["total_refund"])
    balance_after = float(client.get("/wallet", headers=ana).json()["balance"])
    check(abs(balance_after - balance_before - refunded) < 0.01, "the wallet received exactly the reported refund")

    check(client.get("/ops/runs", headers=ana).status_code == 403, "passengers cannot use the staff console")
    check(client.get("/reports/revenue", headers=ana).status_code == 403, "passengers cannot read admin reports")
    check(client.get("/ops/runs").status_code == 401, "the staff console needs a login")

    print("all smoke checks passed")


if __name__ == "__main__":
    main()
