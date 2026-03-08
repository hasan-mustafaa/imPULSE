import type { UserLocation, Hospital } from "@/types/hospital";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === "OK" && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }

  return null;
}

export interface TravelResult {
  durationMinutes: number;
  distanceKm: number;
}

export async function getTravelTime(
  origin: UserLocation,
  destination: { lat: number; lng: number }
): Promise<TravelResult> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const leg = data.routes[0].legs[0];
      return {
        durationMinutes: Math.round(leg.duration.value / 60),
        distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
      };
    }
  } catch (error) {
    console.error("Google Directions API error:", error);
  }

  // Fallback: estimate using haversine distance
  return estimateTravelTime(origin, destination);
}

export async function getBatchTravelTimes(
  origin: UserLocation,
  hospitals: Hospital[]
): Promise<TravelResult[]> {
  // Use Distance Matrix API for batch requests (more efficient)
  const destinations = hospitals
    .map((h) => `${h.lat},${h.lng}`)
    .join("|");
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destinations}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return data.rows[0].elements.map(
        (el: { status: string; duration: { value: number }; distance: { value: number } }) => {
          if (el.status === "OK") {
            return {
              durationMinutes: Math.round(el.duration.value / 60),
              distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
            };
          }
          return estimateTravelTime(origin, hospitals[0]);
        }
      );
    }
  } catch (error) {
    console.error("Distance Matrix API error:", error);
  }

  // Fallback to haversine estimates
  return hospitals.map((h) => estimateTravelTime(origin, h));
}

function estimateTravelTime(
  origin: UserLocation,
  destination: { lat: number; lng: number }
): TravelResult {
  const distanceKm = haversineDistance(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );
  // Rough estimate: avg city speed ~40 km/h
  const durationMinutes = Math.round((distanceKm / 40) * 60);
  return { durationMinutes, distanceKm: Math.round(distanceKm * 10) / 10 };
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
