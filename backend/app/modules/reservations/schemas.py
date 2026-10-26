"""Pydantic schemas for the Reservation Engine module."""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QuotaCode(str, Enum):
    GENERAL = "GN"
    TATKAL = "TQ"
    PREMIUM_TATKAL = "PT"
    LADIES = "LD"
    SENIOR_CITIZEN = "SS"


class BerthPreference(str, Enum):
    LOWER = "LB"
    MIDDLE = "MB"
    UPPER = "UB"
    SIDE_LOWER = "SL"
    SIDE_UPPER = "SU"
    WINDOW_SIDE = "WS"


class ReservationStatus(str, Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    PARTIALLY_CANCELLED = "PARTIALLY_CANCELLED"


class PassengerCreate(BaseModel):
    passenger_name: str = Field(..., min_length=2, max_length=100, description="Full name of passenger")
    age: int = Field(..., ge=1, le=125, description="Age in years")
    gender: str = Field(..., description="Gender: Male, Female, or Transgender")
    berth_preference: Optional[str] = Field(None, description="Preferred berth type (LB, MB, UB, SL, SU)")
    senior_citizen: bool = Field(False, description="Senior citizen status")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        clean = v.strip().capitalize()
        if clean not in ("Male", "Female", "Transgender"):
            raise ValueError("Gender must be 'Male', 'Female', or 'Transgender'")
        return clean

    @field_validator("age")
    @classmethod
    def check_senior_auto(cls, age: int, info) -> int:
        return age


class ReservationCreate(BaseModel):
    train_no: str = Field(..., min_length=1, max_length=10, description="Train number")
    run_date: date = Field(..., description="Journey date from origin")
    from_station_code: str = Field(..., min_length=1, max_length=10, description="Boarding station code")
    to_station_code: str = Field(..., min_length=1, max_length=10, description="Destination station code")
    class_code: str = Field(..., min_length=1, max_length=5, description="Class code (e.g. 1A, 2A, 3A, SL)")
    quota_code: str = Field(default="GN", max_length=5, description="Quota code (GN, TQ, LD, SS)")
    passengers: List[PassengerCreate] = Field(
        ..., min_length=1, max_length=6, description="List of passengers (1 to 6 per reservation)"
    )


class PassengerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    passenger_id: int
    reservation_id: int
    passenger_name: str
    age: int
    gender: str
    berth_preference: Optional[str] = None
    senior_citizen: bool = False
    booking_status: str
    current_status: str
    coach_code: Optional[str] = None
    berth_number: Optional[int] = None
    berth_type: Optional[str] = None
    rac_number: Optional[int] = None
    wl_number: Optional[int] = None
    fare: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reservation_id: int
    pnr: str
    user_id: int
    train_no: str
    train_name: Optional[str] = None
    run_date: date
    from_station_code: str
    to_station_code: str
    from_seq: int
    to_seq: int
    class_code: str
    quota_code: str
    status: str
    total_fare: Decimal
    hold_expires_at: datetime
    passengers: List[PassengerResponse] = []
    created_at: datetime
    updated_at: datetime


class CancelPassengersRequest(BaseModel):
    passenger_ids: List[int] = Field(..., min_length=1, description="List of passenger IDs to cancel")
    reason: Optional[str] = Field("Passenger requested cancellation", max_length=255)


class CancelledPassengerDetail(BaseModel):
    passenger_id: int
    passenger_name: str
    refund_amount: Decimal
    cancellation_charge: Decimal
    status: str


class CancellationResponse(BaseModel):
    pnr: str
    reservation_status: str
    total_refund: Decimal
    cancelled_passengers: List[CancelledPassengerDetail]
    cancelled_at: datetime


class ReservationListResponse(BaseModel):
    items: List[ReservationResponse]
    total: int
    page: int
    page_size: int


class BookingRulesResponse(BaseModel):
    """The configurable booking window (booking_rules, migration 0410). Times are IST."""

    advance_days: int
    tatkal_ac_opens_at: time
    tatkal_non_ac_opens_at: time
    updated_at: datetime


class BookingRulesUpdate(BaseModel):
    advance_days: Optional[int] = Field(None, ge=1, le=365, description="Days ahead general booking opens")
    tatkal_ac_opens_at: Optional[time] = Field(None, description="Tatkal opening time for AC classes (IST)")
    tatkal_non_ac_opens_at: Optional[time] = Field(None, description="Tatkal opening time for non-AC classes (IST)")
