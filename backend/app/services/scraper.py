import re
import httpx
from bs4 import BeautifulSoup

from app.models import Hospital

AHS_WAIT_TIMES_URL = (
    "https://www.albertahealthservices.ca/waittimes/Page14230.aspx"
)

# Known Calgary hospital coordinates (fallback if geocoding fails)
CALGARY_HOSPITALS: dict[str, dict[str, float]] = {
    "foothills medical centre": {"lat": 51.0652, "lng": -114.1335},
    "peter lougheed centre": {"lat": 51.0733, "lng": -113.9811},
    "rockyview general hospital": {"lat": 50.9979, "lng": -114.1019},
    "south health campus": {"lat": 50.8829, "lng": -114.0654},
    "alberta children's hospital": {"lat": 51.0611, "lng": -114.1378},
    "sheldon m. chumir health centre": {"lat": 51.0406, "lng": -114.0752},
}


def _parse_wait_time(text: str) -> int | None:
    cleaned = text.strip().lower()
    if not cleaned or cleaned in ("n/a", "—", "-"):
        return None

    hours_match = re.search(r"(\d+)\s*h", cleaned)
    minutes_match = re.search(r"(\d+)\s*m", cleaned)

    total = 0
    if hours_match:
        total += int(hours_match.group(1)) * 60
    if minutes_match:
        total += int(minutes_match.group(1))

    if not hours_match and not minutes_match:
        try:
            return int(cleaned)
        except ValueError:
            return None

    return total or None


def _lookup_coordinates(name: str) -> dict[str, float] | None:
    lower = name.lower()
    for key, coords in CALGARY_HOSPITALS.items():
        if key in lower or lower in key:
            return coords
    return None


async def scrape_wait_times() -> list[Hospital]:
    """Scrape AHS Calgary wait times page."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(AHS_WAIT_TIMES_URL)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        print(f"Failed to fetch AHS page: {e}")
        return _fallback_hospitals()

    soup = BeautifulSoup(resp.text, "html.parser")
    hospitals: list[Hospital] = []

    # AHS page structure — selectors may need adjustment for live page
    for el in soup.select(".wait-time-entry, .facility-row, tr[data-facility]"):
        name_el = el.select_one(
            ".facility-name, .hospital-name, td:first-child, [data-name]"
        )
        wait_el = el.select_one(
            ".wait-time, .estimated-wait, td:nth-child(2), [data-wait]"
        )
        addr_el = el.select_one(".facility-address, td:nth-child(3)")

        name = (name_el.get_text(strip=True) if name_el else None) or el.get(
            "data-facility", ""
        )
        if not name:
            continue

        wait_text = wait_el.get_text(strip=True) if wait_el else ""
        address = addr_el.get_text(strip=True) if addr_el else ""
        coords = _lookup_coordinates(name)

        hospitals.append(
            Hospital(
                name=name,
                address=address or f"{name}, Calgary, AB",
                lat=coords["lat"] if coords else 0,
                lng=coords["lng"] if coords else 0,
                wait_time_minutes=_parse_wait_time(wait_text),
                wait_time_label=wait_text or "Unknown",
            )
        )

    if not hospitals:
        return _fallback_hospitals()

    return hospitals


def _fallback_hospitals() -> list[Hospital]:
    """Development fallback data."""
    return [
        Hospital(
            name="Foothills Medical Centre",
            address="1403 29 St NW, Calgary, AB T2N 2T9",
            lat=51.0652, lng=-114.1335,
            wait_time_minutes=180, wait_time_label="3h 0m",
        ),
        Hospital(
            name="Peter Lougheed Centre",
            address="3500 26 Ave NE, Calgary, AB T1Y 6J4",
            lat=51.0733, lng=-113.9811,
            wait_time_minutes=120, wait_time_label="2h 0m",
        ),
        Hospital(
            name="Rockyview General Hospital",
            address="7007 14 St SW, Calgary, AB T2V 1P9",
            lat=50.9979, lng=-114.1019,
            wait_time_minutes=90, wait_time_label="1h 30m",
        ),
        Hospital(
            name="South Health Campus",
            address="4448 Front St SE, Calgary, AB T3M 1M4",
            lat=50.8829, lng=-114.0654,
            wait_time_minutes=60, wait_time_label="1h 0m",
        ),
        Hospital(
            name="Alberta Children's Hospital",
            address="2888 Shaganappi Trail NW, Calgary, AB T3B 6A8",
            lat=51.0611, lng=-114.1378,
            wait_time_minutes=45, wait_time_label="0h 45m",
        ),
        Hospital(
            name="Sheldon M. Chumir Health Centre",
            address="1213 4 St SW, Calgary, AB T2R 0X7",
            lat=51.0406, lng=-114.0752,
            wait_time_minutes=30, wait_time_label="0h 30m",
        ),
    ]
