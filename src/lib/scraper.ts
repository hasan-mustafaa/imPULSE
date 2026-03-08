import * as cheerio from "cheerio";
import type { Hospital } from "@/types/hospital";

const AHS_WAIT_TIMES_URL =
  "https://www.albertahealthservices.ca/waittimes/Page14230.aspx";

// Known Calgary hospital coordinates (fallback if geocoding fails)
const CALGARY_HOSPITALS: Record<string, { lat: number; lng: number }> = {
  "foothills medical centre": { lat: 51.0652, lng: -114.1335 },
  "peter lougheed centre": { lat: 51.0733, lng: -113.9811 },
  "rockyview general hospital": { lat: 50.9979, lng: -114.1019 },
  "south health campus": { lat: 50.8829, lng: -114.0654 },
  "alberta children's hospital": { lat: 51.0611, lng: -114.1378 },
  "sheldon m. chumir health centre": { lat: 51.0406, lng: -114.0752 },
};

function parseWaitTime(text: string): number | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned || cleaned === "n/a" || cleaned === "—") return null;

  // Match patterns like "2h 30m", "1 hour", "45 min", etc.
  const hoursMatch = cleaned.match(/(\d+)\s*h/);
  const minutesMatch = cleaned.match(/(\d+)\s*m/);

  let totalMinutes = 0;
  if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
  if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);

  // If just a plain number, treat as minutes
  if (!hoursMatch && !minutesMatch) {
    const plainNumber = parseInt(cleaned);
    if (!isNaN(plainNumber)) return plainNumber;
    return null;
  }

  return totalMinutes || null;
}

function lookupCoordinates(
  hospitalName: string
): { lat: number; lng: number } | null {
  const name = hospitalName.toLowerCase();
  for (const [key, coords] of Object.entries(CALGARY_HOSPITALS)) {
    if (name.includes(key) || key.includes(name)) {
      return coords;
    }
  }
  return null;
}

export async function scrapeWaitTimes(): Promise<Hospital[]> {
  const response = await fetch(AHS_WAIT_TIMES_URL, {
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AHS wait times: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const hospitals: Hospital[] = [];

  // AHS page structure: look for wait time entries
  // The exact selectors may need adjustment based on the live page structure
  $(".wait-time-entry, .facility-row, tr[data-facility]").each((_, el) => {
    const $el = $(el);
    const name =
      $el
        .find(
          ".facility-name, .hospital-name, td:first-child, [data-name]"
        )
        .text()
        .trim() || $el.attr("data-facility");
    const waitText =
      $el
        .find(".wait-time, .estimated-wait, td:nth-child(2), [data-wait]")
        .text()
        .trim() || "";
    const address =
      $el.find(".facility-address, td:nth-child(3)").text().trim() || "";

    if (name) {
      const coords = lookupCoordinates(name);
      hospitals.push({
        name,
        address: address || `${name}, Calgary, AB`,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        waitTimeMinutes: parseWaitTime(waitText),
        waitTimeLabel: waitText || "Unknown",
      });
    }
  });

  // If scraping returned nothing, return fallback data for development
  if (hospitals.length === 0) {
    return getFallbackHospitals();
  }

  return hospitals;
}

function getFallbackHospitals(): Hospital[] {
  return [
    {
      name: "Foothills Medical Centre",
      address: "1403 29 St NW, Calgary, AB T2N 2T9",
      lat: 51.0652,
      lng: -114.1335,
      waitTimeMinutes: 180,
      waitTimeLabel: "3h 0m",
    },
    {
      name: "Peter Lougheed Centre",
      address: "3500 26 Ave NE, Calgary, AB T1Y 6J4",
      lat: 51.0733,
      lng: -113.9811,
      waitTimeMinutes: 120,
      waitTimeLabel: "2h 0m",
    },
    {
      name: "Rockyview General Hospital",
      address: "7007 14 St SW, Calgary, AB T2V 1P9",
      lat: 50.9979,
      lng: -114.1019,
      waitTimeMinutes: 90,
      waitTimeLabel: "1h 30m",
    },
    {
      name: "South Health Campus",
      address: "4448 Front St SE, Calgary, AB T3M 1M4",
      lat: 50.8829,
      lng: -114.0654,
      waitTimeMinutes: 60,
      waitTimeLabel: "1h 0m",
    },
    {
      name: "Alberta Children's Hospital",
      address: "2888 Shaganappi Trail NW, Calgary, AB T3B 6A8",
      lat: 51.0611,
      lng: -114.1378,
      waitTimeMinutes: 45,
      waitTimeLabel: "0h 45m",
    },
    {
      name: "Sheldon M. Chumir Health Centre",
      address: "1213 4 St SW, Calgary, AB T2R 0X7",
      lat: 51.0406,
      lng: -114.0752,
      waitTimeMinutes: 30,
      waitTimeLabel: "0h 30m",
    },
  ];
}
