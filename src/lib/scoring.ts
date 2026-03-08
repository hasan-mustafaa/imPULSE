import type { Hospital, HospitalWithScore } from "@/types/hospital";
import type { TravelResult } from "@/lib/maps";

interface ScoringWeights {
  waitTime: number;
  travelTime: number;
}

const SEVERITY_WEIGHTS: Record<string, ScoringWeights> = {
  low: { waitTime: 0.3, travelTime: 0.7 },      // Prefer closer hospitals
  medium: { waitTime: 0.5, travelTime: 0.5 },    // Balanced
  high: { waitTime: 0.7, travelTime: 0.3 },      // Prefer shorter waits
  critical: { waitTime: 0.9, travelTime: 0.1 },  // Nearest capable hospital
};

export function computeScores(
  hospitals: Hospital[],
  travelResults: TravelResult[],
  severity: string = "medium"
): HospitalWithScore[] {
  const weights = SEVERITY_WEIGHTS[severity] || SEVERITY_WEIGHTS.medium;

  // Normalize values for scoring
  const maxWait = Math.max(
    ...hospitals.map((h) => h.waitTimeMinutes ?? 240)
  );
  const maxTravel = Math.max(...travelResults.map((t) => t.durationMinutes));

  const scored: HospitalWithScore[] = hospitals.map((hospital, i) => {
    const travel = travelResults[i];
    const waitTime = hospital.waitTimeMinutes ?? 240; // Default to 4h if unknown

    // Normalized scores (0 = best, 1 = worst)
    const normalizedWait = maxWait > 0 ? waitTime / maxWait : 0;
    const normalizedTravel =
      maxTravel > 0 ? travel.durationMinutes / maxTravel : 0;

    // Combined score using logarithmic scaling for diminishing returns
    const waitScore = Math.log1p(normalizedWait * 10);
    const travelScore = Math.log1p(normalizedTravel * 10);

    const priorityScore =
      weights.waitTime * waitScore + weights.travelTime * travelScore;

    return {
      ...hospital,
      travelTimeMinutes: travel.durationMinutes,
      distanceKm: travel.distanceKm,
      priorityScore: Math.round(priorityScore * 100) / 100,
      rank: 0,
    };
  });

  // Sort by priority score (lower is better)
  scored.sort((a, b) => a.priorityScore - b.priorityScore);

  // Assign ranks
  scored.forEach((h, i) => {
    h.rank = i + 1;
  });

  return scored;
}
