from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.models import HospitalWithScore, RecommendationRequest, RecommendationResponse
from app.services.scraper import scrape_wait_times
from app.services.maps import get_batch_travel_times
from app.services.scoring import compute_scores
from app.services.ai_ranking import get_ai_ranking

router = APIRouter(prefix="/api", tags=["recommend"])


@router.post("/recommend", response_model=RecommendationResponse)
async def recommend(req: RecommendationRequest) -> RecommendationResponse:
    # 1. Scrape wait times
    hospitals = await scrape_wait_times()

    # 2. Calculate travel times
    travel_results = await get_batch_travel_times(req.lat, req.lng, hospitals)

    # 3. Compute priority scores
    scored = compute_scores(hospitals, travel_results, req.sort_by, req.wait_weight)

    return RecommendationResponse(
        hospitals=scored,
        user_location={"lat": req.lat, "lng": req.lng},
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


class AnalyzeRequest(BaseModel):
    hospitals: list[HospitalWithScore]
    sort_by: str = "shortest_total"


@router.post("/analyze", response_model=list[HospitalWithScore])
async def analyze(req: AnalyzeRequest) -> list[HospitalWithScore]:
    """Enrich existing hospital results with Gemini AI reasoning."""
    return await get_ai_ranking(req.hospitals, req.sort_by)
