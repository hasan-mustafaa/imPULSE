from pydantic import BaseModel, Field
from enum import Enum


class SortMode(str, Enum):
    shortest_wait = "shortest_wait"
    shortest_commute = "shortest_commute"
    shortest_total = "shortest_total"
    custom = "custom"


class Hospital(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    wait_time_minutes: int | None = None
    wait_time_label: str = "Unknown"


class HospitalWithScore(Hospital):
    travel_time_minutes: float = 0
    distance_km: float = 0
    total_time_minutes: float = 0
    priority_score: float = 0
    rank: int = 0
    ai_reasoning: str | None = None


class RecommendationRequest(BaseModel):
    lat: float
    lng: float
    sort_by: SortMode = SortMode.shortest_total
    wait_weight: float = Field(default=0.5, ge=0.0, le=1.0)


class RecommendationResponse(BaseModel):
    hospitals: list[HospitalWithScore]
    user_location: dict[str, float]
    generated_at: str
