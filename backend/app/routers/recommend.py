from datetime import datetime, timezone

from fastapi import APIRouter

from app.models import RecommendationRequest, RecommendationResponse
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
    scored = compute_scores(hospitals, travel_results, req.severity.value)

    # 4. AI-assisted ranking
    ranked = await get_ai_ranking(scored, req.severity.value)

    return RecommendationResponse(
        hospitals=ranked,
        user_location={"lat": req.lat, "lng": req.lng},
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
