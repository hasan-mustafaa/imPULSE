import { NextResponse } from "next/server";
import { scrapeWaitTimes } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hospitals = await scrapeWaitTimes();
    return NextResponse.json({ hospitals, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error fetching hospitals:", error);
    return NextResponse.json(
      { error: "Failed to fetch hospital data" },
      { status: 500 }
    );
  }
}
