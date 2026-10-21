"""Unit tests for Reservation Engine Pydantic schemas."""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.modules.reservations.schemas import (
    CancelPassengersRequest,
    PassengerCreate,
    QuotaCode,
    ReservationCreate,
)


def test_passenger_create_validation():
    # Valid passenger
    p = PassengerCreate(
        passenger_name="Rahul Verma",
        age=34,
        gender="male",
        berth_preference="LB",
    )
    assert p.gender == "Male"
    assert p.passenger_name == "Rahul Verma"

    # Age boundary checks
    with pytest.raises(ValidationError):
        PassengerCreate(passenger_name="Baby", age=0, gender="Male")

    with pytest.raises(ValidationError):
        PassengerCreate(passenger_name="Ancient", age=130, gender="Male")

    # Invalid gender
    with pytest.raises(ValidationError):
        PassengerCreate(passenger_name="Alex", age=25, gender="Alien")


def test_reservation_create_validation():
    valid_passenger = PassengerCreate(passenger_name="Sita Devi", age=62, gender="Female", senior_citizen=True)
    journey_date = date.today() + timedelta(days=10)

    res = ReservationCreate(
        train_no="12424",
        run_date=journey_date,
        from_station_code="NDLS",
        to_station_code="DDU",
        class_code="3A",
        quota_code=QuotaCode.GENERAL,
        passengers=[valid_passenger],
    )
    assert res.train_no == "12424"
    assert len(res.passengers) == 1

    # Max passengers limit (cannot exceed 6 passengers)
    excess_passengers = [
        PassengerCreate(passenger_name=f"Passenger {i}", age=20 + i, gender="Male")
        for i in range(7)
    ]
    with pytest.raises(ValidationError):
        ReservationCreate(
            train_no="12424",
            run_date=journey_date,
            from_station_code="NDLS",
            to_station_code="DDU",
            class_code="3A",
            passengers=excess_passengers,
        )

    # Empty passengers list
    with pytest.raises(ValidationError):
        ReservationCreate(
            train_no="12424",
            run_date=journey_date,
            from_station_code="NDLS",
            to_station_code="DDU",
            class_code="3A",
            passengers=[],
        )


def test_cancel_passengers_request():
    req = CancelPassengersRequest(passenger_ids=[101, 102], reason="Meeting postponed")
    assert req.passenger_ids == [101, 102]
    assert req.reason == "Meeting postponed"

    with pytest.raises(ValidationError):
        CancelPassengersRequest(passenger_ids=[])
