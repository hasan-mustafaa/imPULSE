import json
import re

import httpx

from app.config import get_settings
from app.models import HospitalWithScore


async def get_ai_ranking(
    hospitals: list[HospitalWithScore],
    sort_by: str = "shortest_total",
) -> list[HospitalWithScore]:
    """Re-rank hospitals using Gemini AI with detailed analysis."""
    settings = get_settings()

    if not settings.gemini_api_key or not hospitals:
        return hospitals

    hospital_list = "\n".join(
        f"- {h.name}: Wait {h.wait_time_label}, "
        f"Drive {h.travel_time_minutes:.0f}min, "
        f"Total {h.total_time_minutes:.0f}min, "
        f"Distance {h.distance_km}km"
        for h in hospitals
    )

    prompt = (
        "You are an expert medical advisor helping a patient choose the best emergency department.\n\n"
        f"The patient's current sort preference is: {sort_by.replace('_', ' ')}.\n\n"
        f"Here are the nearby hospitals:\n{hospital_list}\n\n"
        "Your job:\n"
        "1. RE-RANK these hospitals from best (#1) to worst, using your own judgment. "
        "Consider wait times, drive times, the overall total, and any knowledge you have about "
        "these hospitals (capacity, trauma level, specializations, typical crowding patterns).\n"
        "2. For EACH hospital, write a 2-3 sentence analysis explaining WHY you ranked it there. "
        "Mention specific numbers. If it's a top pick, say why. If it's ranked low, explain the trade-off.\n\n"
        "Return ONLY a JSON array sorted by your recommended rank (best first). No markdown fences:\n"
        '[\n'
        '  {"name": "Hospital Name", "ai_rank": 1, "reasoning": "2-3 sentence analysis."},\n'
        '  ...\n'
        ']'
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()

        text = data["candidates"][0]["content"]["parts"][0]["text"]

        # Strip optional markdown code fences
        text = re.sub(r"```(?:json)?", "", text).strip()

        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            print(f"[ai_ranking] Could not find JSON array in: {text[:300]}")
            return hospitals

        rankings: list[dict] = json.loads(match.group())

        # Build lookup by name (fuzzy match)
        hospital_map: dict[str, HospitalWithScore] = {}
        for h in hospitals:
            hospital_map[h.name.lower()] = h

        for entry in rankings:
            name = entry.get("name", "")
            ai_rank = entry.get("ai_rank", 0)
            reasoning = entry.get("reasoning", "")

            # Fuzzy match hospital name
            matched = hospital_map.get(name.lower())
            if not matched:
                matched = next(
                    (h for key, h in hospital_map.items()
                     if key in name.lower() or name.lower() in key),
                    None,
                )
            if matched:
                matched.rank = ai_rank
                matched.ai_reasoning = reasoning

        # Re-sort by AI rank
        hospitals.sort(key=lambda h: h.rank)

    except Exception as e:
        print(f"[ai_ranking] Gemini API error: {e}")

    return hospitals
