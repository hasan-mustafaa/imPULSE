import asyncio
import re
import time
from dataclasses import dataclass, field

from playwright.async_api import async_playwright, Browser, Playwright

from app.models import Hospital

AHS_WAIT_TIMES_URL = (
    "https://www.albertahealthservices.ca/waittimes/Page14230.aspx"
)

# All AHS cities: CSS class suffix -> display city name
AHS_CITIES: dict[str, str] = {
    "calgary": "Calgary",
    "edmonton": "Edmonton",
    "grandeprairie": "Grande Prairie",
    "lethbridge": "Lethbridge",
    "medicinehat": "Medicine Hat",
    "reddeer": "Red Deer",
    "fortmcmurray": "Fort McMurray",
}

# Hospital coordinates for all AHS cities
HOSPITAL_COORDS: dict[str, dict[str, float]] = {
    # Calgary
    "foothills medical centre": {"lat": 51.0652, "lng": -114.1335},
    "peter lougheed centre": {"lat": 51.0733, "lng": -113.9811},
    "rockyview general hospital": {"lat": 50.9979, "lng": -114.1019},
    "south health campus": {"lat": 50.8829, "lng": -114.0654},
    "alberta children's hospital": {"lat": 51.0611, "lng": -114.1378},
    "sheldon m. chumir centre": {"lat": 51.0406, "lng": -114.0752},
    "airdrie community health centre": {"lat": 51.2917, "lng": -114.0144},
    "cochrane community health centre": {"lat": 51.1868, "lng": -114.4716},
    "okotoks health and wellness centre": {"lat": 50.7254, "lng": -113.9751},
    "south calgary health centre": {"lat": 50.9372, "lng": -114.0708},
    # Edmonton
    "devon general hospital": {"lat": 53.3645, "lng": -113.7369},
    "fort sask community hospital": {"lat": 53.7130, "lng": -113.2130},
    "grey nuns community hospital": {"lat": 53.4792, "lng": -113.4233},
    "leduc community hospital": {"lat": 53.2656, "lng": -113.5490},
    "misericordia community hospital": {"lat": 53.5289, "lng": -113.5396},
    "northeast community health centre": {"lat": 53.5876, "lng": -113.3699},
    "royal alexandra hospital": {"lat": 53.5581, "lng": -113.4966},
    "stollery children's hospital": {"lat": 53.5219, "lng": -113.5264},
    "strathcona community hospital": {"lat": 53.5110, "lng": -113.3097},
    "sturgeon community hospital": {"lat": 53.6290, "lng": -113.8007},
    "university of alberta hospital": {"lat": 53.5219, "lng": -113.5264},
    "westview health centre": {"lat": 53.5573, "lng": -114.3717},
    # Grande Prairie
    "grande prairie regional hospital": {"lat": 55.1639, "lng": -118.7878},
    # Lethbridge
    "chinook regional hospital": {"lat": 49.6979, "lng": -112.8421},
    # Medicine Hat
    "medicine hat regional hospital": {"lat": 50.0346, "lng": -110.6776},
    # Red Deer
    "red deer regional hospital": {"lat": 52.2541, "lng": -113.8116},
    "innisfail health centre": {"lat": 52.0279, "lng": -113.9542},
    "lacombe hospital and care centre": {"lat": 52.4698, "lng": -113.7371},
    # Fort McMurray
    "northern lights regional health centre": {"lat": 56.7267, "lng": -111.3793},
}

# Cache config — AHS updates every 2 minutes
CACHE_TTL_SECONDS = 120


@dataclass
class _Cache:
    hospitals: list[Hospital] = field(default_factory=list)
    timestamp: float = 0.0


_cache = _Cache()

# Browser singleton
_playwright_instance: Playwright | None = None
_browser: Browser | None = None


async def _get_browser() -> Browser:
    global _playwright_instance, _browser
    if _browser is None or not _browser.is_connected():
        _playwright_instance = await async_playwright().start()
        _browser = await _playwright_instance.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
    return _browser


async def close_browser() -> None:
    global _browser, _playwright_instance
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright_instance:
        await _playwright_instance.stop()
        _playwright_instance = None


def _parse_wait_time(text: str) -> int | None:
    cleaned = text.strip().lower()
    if not cleaned or cleaned in ("n/a", "—", "-", "closed", "closing soon", "wait times unavailable"):
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
    for key, coords in HOSPITAL_COORDS.items():
        if key in lower or lower in key:
            return coords
    return None


async def _scrape_from_page() -> list[Hospital]:
    """Use Playwright to scrape wait times from AHS page for all Alberta cities.

    AHS page structure:
        <div class="cityContent-{city}">
          <div class="well wt-well">
            <div class="wt-times">
              <span><strong>3</strong> <label>hr</label> <strong>26</strong> <label>min</label></span>
            </div>
            <div class="wt-description">
              <p class="hospitalName"><strong><a href="...">Hospital Name</a></strong></p>
              <p class="hospitalCateg"><span class="wt-category">Emergency</span></p>
            </div>
          </div>
        </div>

    All city data is loaded in the DOM on page load — no need to switch cities.
    """
    browser = await _get_browser()
    context = await browser.new_context()
    page = await context.new_page()

    try:
        await page.goto(AHS_WAIT_TIMES_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        # Trigger any city to ensure all city data is rendered
        await page.select_option("select", value="Calgary")
        await page.wait_for_selector(".wt-well", timeout=15000)
        await page.wait_for_timeout(2000)

        hospitals: list[Hospital] = []

        for city_key, city_name in AHS_CITIES.items():
            entries = await page.query_selector_all(f".cityContent-{city_key} .wt-well")

            for entry in entries:
                name_el = await entry.query_selector(".hospitalName a")
                if not name_el:
                    name_el = await entry.query_selector(".hospitalName")
                if not name_el:
                    continue
                name = (await name_el.inner_text()).strip()
                if not name:
                    continue

                time_el = await entry.query_selector(".wt-times")
                wait_text = (await time_el.inner_text()).strip() if time_el else ""

                coords = _lookup_coordinates(name)

                hospitals.append(Hospital(
                    name=name,
                    address=f"{name}, {city_name}, AB",
                    lat=coords["lat"] if coords else 0,
                    lng=coords["lng"] if coords else 0,
                    wait_time_minutes=_parse_wait_time(wait_text),
                    wait_time_label=wait_text or "Unknown",
                ))

        # Geocode hospitals whose coordinates weren't in the lookup table
        unknown = [h for h in hospitals if h.lat == 0 and h.lng == 0]
        if unknown:
            from app.services.maps import geocode_address
            results = await asyncio.gather(
                *[geocode_address(h.address) for h in unknown],
                return_exceptions=True,
            )
            for h, result in zip(unknown, results):
                if isinstance(result, dict):
                    h.lat = result["lat"]
                    h.lng = result["lng"]

        # Drop any hospitals still missing coordinates
        hospitals = [h for h in hospitals if h.lat != 0 and h.lng != 0]

        return hospitals

    finally:
        await context.close()


async def scrape_wait_times() -> list[Hospital]:
    """Scrape AHS wait times for all Alberta cities."""
    # Return cached data if fresh
    if _cache.hospitals and (time.time() - _cache.timestamp < CACHE_TTL_SECONDS):
        return _cache.hospitals

    try:
        hospitals = await _scrape_from_page()
        if hospitals:
            _cache.hospitals = hospitals
            _cache.timestamp = time.time()
            return hospitals
    except Exception as e:
        print(f"[scraper] Playwright scrape failed: {e}")

    # Return stale cache if available, otherwise fallback
    if _cache.hospitals:
        return _cache.hospitals
    return _fallback_hospitals()


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
