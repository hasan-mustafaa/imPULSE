import { NextRequest, NextResponse } from "next/server";
import { scrapeWaitTimes } from "@/lib/scraper";
import { getBatchTravelTimes } from "@/lib/maps";
import { computeScores } from "@/lib/scoring";
import { getAIRanking } from "@/lib/ai-ranking";
import type { RecommendationRequest } from "@/types/hospital";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: RecommendationRequest = await request.json();
    const { lat, lng, severity = "medium" } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      );
    }

    // Step 1: Get hospital wait times
    const hospitals = await scrapeWaitTimes();

    // Step 2: Calculate travel times from user to each hospital
    const travelResults = await getBatchTravelTimes({ lat, lng }, hospitals);

    // Step 3: Compute priority scores
    const scored = computeScores(hospitals, travelResults, severity);

    // Step 4: AI-assisted ranking (enriches with reasoning)
    const { hospitals: ranked } = await getAIRanking(scored, severity);

    return NextResponse.json({
      hospitals: ranked,
      userLocation: { lat, lng },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
