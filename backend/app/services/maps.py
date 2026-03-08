import math
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.models import Hospital


@dataclass
class TravelResult:
    duration_minutes: float
    distance_km: float


async def geocode_address(address: str) -> dict[str, float] | None:
    settings = get_settings()
    if not settings.google_maps_api_key:
        return None

    url = (
        f"https://maps.googleapis.com/maps/api/geocode/json"
        f"?address={address}&key={settings.google_maps_api_key}"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        data = resp.json()

    if data.get("status") == "OK" and data.get("results"):
        loc = data["results"][0]["geometry"]["location"]
        return {"lat": loc["lat"], "lng": loc["lng"]}
    return None


async def get_batch_travel_times(
    origin_lat: float,
    origin_lng: float,
    hospitals: list[Hospital],
) -> list[TravelResult]:
    """Get travel times from origin to all hospitals using Distance Matrix API."""
    settings = get_settings()

    if not settings.google_maps_api_key:
        return [
            _estimate_travel(origin_lat, origin_lng, h.lat, h.lng)
            for h in hospitals
        ]

    destinations = "|".join(f"{h.lat},{h.lng}" for h in hospitals)
    url = (
        f"https://maps.googleapis.com/maps/api/distancematrix/json"
        f"?origins={origin_lat},{origin_lng}"
        f"&destinations={destinations}"
        f"&key={settings.google_maps_api_key}"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            data = resp.json()

        if data.get("status") == "OK":
            results: list[TravelResult] = []
            for i, el in enumerate(data["rows"][0]["elements"]):
                if el.get("status") == "OK":
                    results.append(
                        TravelResult(
                            duration_minutes=round(el["duration"]["value"] / 60),
                            distance_km=round(el["distance"]["value"] / 1000, 1),
                        )
                    )
                else:
                    results.append(
                        _estimate_travel(
                            origin_lat, origin_lng,
                            hospitals[i].lat, hospitals[i].lng,
                        )
                    )
            return results
    except httpx.HTTPError as e:
        print(f"Distance Matrix API error: {e}")

    return [
        _estimate_travel(origin_lat, origin_lng, h.lat, h.lng)
        for h in hospitals
    ]


def _estimate_travel(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> TravelResult:
    dist = _haversine(lat1, lon1, lat2, lon2)
    duration = round((dist / 40) * 60)  # ~40 km/h city avg
    return TravelResult(duration_minutes=duration, distance_km=round(dist, 1))


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371  # Earth radius km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
