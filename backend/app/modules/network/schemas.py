from datetime import date, datetime, time

from pydantic import BaseModel


class StationOut(BaseModel):
    station_code: str
    name: str


class StationPage(BaseModel):
    items: list[StationOut]
    page: int
    page_size: int
    total: int


class Leg(BaseModel):
    train_no: str
    train_name: str
    run_date: date
    from_code: str
    to_code: str
    from_seq: int
    to_seq: int
    depart_at: datetime
    arrive_at: datetime
    duration_minutes: int
    distance_km: int


class ConnectingJourney(BaseModel):
    rank: int
    interchange: StationOut
    wait_minutes: int
    total_minutes: int
    leg1: Leg
    leg2: Leg


class JourneyResults(BaseModel):
    from_station: StationOut
    to_station: StationOut
    date: date
    direct: list[Leg]
    connecting: list[ConnectingJourney]


class StopOut(BaseModel):
    seq: int
    station_code: str
    station_name: str
    arrival: time | None
    departure: time | None
    day_offset: int
    distance_km: int


class Timetable(BaseModel):
    train_no: str
    name: str
    source: StationOut | None
    destination: StationOut | None
    running_days: list[int]
    stops: list[StopOut]
