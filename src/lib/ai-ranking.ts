import type { HospitalWithScore } from "@/types/hospital";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

interface AIRankingResult {
  hospitals: HospitalWithScore[];
}

export async function getAIRanking(
  hospitals: HospitalWithScore[],
  severity: string = "medium"
): Promise<AIRankingResult> {
  if (!ANTHROPIC_API_KEY) {
    // Return hospitals as-is if no API key configured
    return { hospitals };
  }

  const hospitalSummary = hospitals
    .map(
      (h) =>
        `- ${h.name}: Wait ${h.waitTimeLabel}, Travel ${h.travelTimeMinutes}min (${h.distanceKm}km), Score ${h.priorityScore}`
    )
    .join("\n");

  const prompt = `You are a medical triage assistant helping recommend hospitals.

Patient severity: ${severity}

Available hospitals (already scored by wait time + travel time):
${hospitalSummary}

For each hospital, provide a brief 1-sentence reasoning for its ranking.
Consider: wait times, travel distance, hospital specialization, and severity level.

Respond in JSON format:
{
  "rankings": [
    { "name": "Hospital Name", "reasoning": "Brief explanation" }
  ]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.statusText);
      return { hospitals };
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.text || "";

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const rankings = parsed.rankings || [];

      // Merge AI reasoning into hospital data
      const enriched = hospitals.map((h) => {
        const aiEntry = rankings.find(
          (r: { name: string; reasoning: string }) =>
            r.name.toLowerCase().includes(h.name.toLowerCase()) ||
            h.name.toLowerCase().includes(r.name.toLowerCase())
        );
        return {
          ...h,
          aiReasoning: aiEntry?.reasoning || undefined,
        };
      });

      return { hospitals: enriched };
    }
  } catch (error) {
    console.error("AI ranking error:", error);
  }

  return { hospitals };
}
