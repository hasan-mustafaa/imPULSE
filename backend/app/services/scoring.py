import math

from app.models import Hospital, HospitalWithScore, SortMode
from app.services.maps import TravelResult


def compute_scores(
    hospitals: list[Hospital],
    travel_results: list[TravelResult],
    sort_by: SortMode = SortMode.shortest_total,
    wait_weight: float = 0.5,
) -> list[HospitalWithScore]:
    # Build scored list with all computed fields
    scored: list[HospitalWithScore] = []
    for hospital, travel in zip(hospitals, travel_results):
        wait = hospital.wait_time_minutes or 240  # default 4h if unknown
        total = wait + travel.duration_minutes

        scored.append(
            HospitalWithScore(
                **hospital.model_dump(),
                travel_time_minutes=travel.duration_minutes,
                distance_km=travel.distance_km,
                total_time_minutes=total,
                priority_score=0,
                rank=0,
            )
        )

    # Normalize for custom weighting
    max_wait = max((h.wait_time_minutes or 240) for h in hospitals) or 1
    max_travel = max(t.duration_minutes for t in travel_results) or 1

    for h in scored:
        wait = h.wait_time_minutes or 240
        norm_wait = wait / max_wait
        norm_travel = h.travel_time_minutes / max_travel

        if sort_by == SortMode.shortest_wait:
            h.priority_score = round(wait, 1)
        elif sort_by == SortMode.shortest_commute:
            h.priority_score = round(h.travel_time_minutes, 1)
        elif sort_by == SortMode.shortest_total:
            h.priority_score = round(h.total_time_minutes, 1)
        else:
            # Custom: use wait_weight slider (0 = all commute, 1 = all wait)
            travel_weight = 1.0 - wait_weight
            score = (
                wait_weight * math.log1p(norm_wait * 10)
                + travel_weight * math.log1p(norm_travel * 10)
            )
            h.priority_score = round(score, 2)

    scored.sort(key=lambda h: h.priority_score)
    for i, h in enumerate(scored):
        h.rank = i + 1

    return scored
