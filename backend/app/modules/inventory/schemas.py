from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AvailabilityCell(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    travel_date: date
    class_code: str
    class_name: str
    status: str
    available_count: int = Field(ge=0)
    rac_count: int = Field(ge=0)
    wl_count: int = Field(ge=0)
    fare: Decimal


class AvailabilityResponse(BaseModel):
    train_no: str
    from_station: str
    to_station: str
    quota: str
    items: list[AvailabilityCell]


class FareBreakdown(BaseModel):
    distance_km: int
    class_code: str
    quota_code: str
    concession_code: str
    base_fare: Decimal
    reservation_fee: Decimal
    superfast_charge: Decimal
    tatkal_charge: Decimal
    concession_discount: Decimal
    gst: Decimal
    total_fare: Decimal


class BerthLayout(BaseModel):
    berth_id: int
    berth_number: int
    berth_type: str
    is_available: bool


class CoachLayoutResponse(BaseModel):
    coach_id: int
    coach_code: str
    class_code: str
    total_berths: int
    berths: list[BerthLayout]


class CoachSummary(BaseModel):
    coach_id: int
    coach_code: str
    class_code: str
    total_berths: int


class TravelClassItem(BaseModel):
    class_code: str
    name: str
    base_multiplier: Decimal
    has_ac: bool


class QuotaItem(BaseModel):
    quota_code: str
    name: str
