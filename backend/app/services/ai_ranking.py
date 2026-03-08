import json

import anthropic

from app.config import get_settings
from app.models import HospitalWithScore


async def get_ai_ranking(
    hospitals: list[HospitalWithScore],
    severity: str = "medium",
) -> list[HospitalWithScore]:
    """Enrich hospital rankings with AI-generated reasoning."""
    settings = get_settings()

    if not settings.anthropic_api_key:
        return hospitals

    summary = "\n".join(
        f"- {h.name}: Wait {h.wait_time_label}, "
        f"Travel {h.travel_time_minutes}min ({h.distance_km}km), "
        f"Score {h.priority_score}"
        for h in hospitals
    )

    prompt = (
        "You are a medical triage assistant helping recommend hospitals.\n\n"
        f"Patient severity: {severity}\n\n"
        f"Available hospitals (already scored by wait time + travel time):\n{summary}\n\n"
        "For each hospital, provide a brief 1-sentence reasoning for its ranking.\n"
        "Consider: wait times, travel distance, hospital specialization, and severity level.\n\n"
        'Respond in JSON format:\n'
        '{\n  "rankings": [\n'
        '    { "name": "Hospital Name", "reasoning": "Brief explanation" }\n'
        "  ]\n}"
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        text = message.content[0].text if message.content else ""

        # Extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            rankings = parsed.get("rankings", [])

            for h in hospitals:
                match = next(
                    (
                        r
                        for r in rankings
                        if r["name"].lower() in h.name.lower()
                        or h.name.lower() in r["name"].lower()
                    ),
                    None,
                )
                if match:
                    h.ai_reasoning = match.get("reasoning")

    except Exception as e:
        print(f"AI ranking error: {e}")

    return hospitals
