from pydantic import BaseModel
from enum import Enum


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


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
    priority_score: float = 0
    rank: int = 0
    ai_reasoning: str | None = None


class RecommendationRequest(BaseModel):
    lat: float
    lng: float
    severity: Severity = Severity.medium


class RecommendationResponse(BaseModel):
    hospitals: list[HospitalWithScore]
    user_location: dict[str, float]
    generated_at: str
