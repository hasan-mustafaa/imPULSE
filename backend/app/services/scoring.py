import math

from app.models import Hospital, HospitalWithScore
from app.services.maps import TravelResult

SEVERITY_WEIGHTS: dict[str, dict[str, float]] = {
    "low": {"wait": 0.3, "travel": 0.7},
    "medium": {"wait": 0.5, "travel": 0.5},
    "high": {"wait": 0.7, "travel": 0.3},
    "critical": {"wait": 0.9, "travel": 0.1},
}


def compute_scores(
    hospitals: list[Hospital],
    travel_results: list[TravelResult],
    severity: str = "medium",
) -> list[HospitalWithScore]:
    weights = SEVERITY_WEIGHTS.get(severity, SEVERITY_WEIGHTS["medium"])

    max_wait = max((h.wait_time_minutes or 240) for h in hospitals)
    max_travel = max(t.duration_minutes for t in travel_results) if travel_results else 1

    scored: list[HospitalWithScore] = []
    for hospital, travel in zip(hospitals, travel_results):
        wait = hospital.wait_time_minutes or 240

        norm_wait = wait / max_wait if max_wait > 0 else 0
        norm_travel = travel.duration_minutes / max_travel if max_travel > 0 else 0

        wait_score = math.log1p(norm_wait * 10)
        travel_score = math.log1p(norm_travel * 10)

        priority = round(
            weights["wait"] * wait_score + weights["travel"] * travel_score, 2
        )

        scored.append(
            HospitalWithScore(
                **hospital.model_dump(),
                travel_time_minutes=travel.duration_minutes,
                distance_km=travel.distance_km,
                priority_score=priority,
                rank=0,
            )
        )

    scored.sort(key=lambda h: h.priority_score)
    for i, h in enumerate(scored):
        h.rank = i + 1

    return scored
