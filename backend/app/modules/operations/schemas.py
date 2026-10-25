from datetime import date

from pydantic import BaseModel, Field


class DelayRequest(BaseModel):
    delay_minutes: int = Field(ge=0, le=1440, description="Total delay of the run, in minutes")
    station_code: str | None = Field(default=None, max_length=10, description="Where the delay happened")
    notes: str | None = Field(default=None, max_length=500)


class CancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class RunOut(BaseModel):
    run_id: int
    train_no: str
    train_name: str
    run_date: date
    status: str
    delay_minutes: int
    chart_prepared: bool


class CancelOut(BaseModel):
    run_id: int
    status: str
    passengers_cancelled: int
    total_refunded: float
