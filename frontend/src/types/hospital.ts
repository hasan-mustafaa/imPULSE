export interface HospitalWithScore {
  name: string;
  address: string;
  lat: number;
  lng: number;
  wait_time_minutes: number | null;
  wait_time_label: string;
  travel_time_minutes: number;
  distance_km: number;
  total_time_minutes: number;
  priority_score: number;
  rank: number;
  ai_reasoning?: string | null;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface RecommendationResponse {
  hospitals: HospitalWithScore[];
  user_location: UserLocation;
  generated_at: string;
}

export type SortMode =
  | "shortest_wait"
  | "shortest_commute"
  | "shortest_total"
  | "custom";
