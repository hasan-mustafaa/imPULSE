export interface Hospital {
  name: string;
  address: string;
  lat: number;
  lng: number;
  waitTimeMinutes: number | null;
  waitTimeLabel: string;
}

export interface HospitalWithScore extends Hospital {
  travelTimeMinutes: number;
  distanceKm: number;
  priorityScore: number;
  rank: number;
  aiReasoning?: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface RecommendationRequest {
  lat: number;
  lng: number;
  severity?: "low" | "medium" | "high" | "critical";
}

export interface RecommendationResponse {
  hospitals: HospitalWithScore[];
  userLocation: UserLocation;
  generatedAt: string;
}
