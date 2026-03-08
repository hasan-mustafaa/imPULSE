from datetime import datetime, timezone

from fastapi import APIRouter

from app.models import Hospital
from app.services.scraper import scrape_wait_times

router = APIRouter(prefix="/api", tags=["hospitals"])


@router.get("/hospitals")
async def get_hospitals() -> dict:
    hospitals: list[Hospital] = await scrape_wait_times()
    return {
        "hospitals": [h.model_dump() for h in hospitals],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
