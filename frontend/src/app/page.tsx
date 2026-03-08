"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Map from "@/components/Map";
import HospitalCard from "@/components/HospitalCard";
import SortControls from "@/components/SortControls";
import type {
  HospitalWithScore,
  UserLocation,
  RecommendationResponse,
  SortMode,
} from "@/types/hospital";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function geocodeAddress(address: string): Promise<UserLocation | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status === "OK" && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }
  return null;
}

export default function Home() {
  const [hospitals, setHospitals] = useState<HospitalWithScore[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedHospital, setSelectedHospital] =
    useState<HospitalWithScore | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("shortest_total");
  const [waitWeight, setWaitWeight] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  const hasResultsRef = useRef(false);
  const cachedLocationRef = useRef<UserLocation | null>(null);

  const getBrowserLocation = useCallback((): Promise<UserLocation> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 51.0447, lng: -114.0719 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 51.0447, lng: -114.0719 }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const resolveLocation = useCallback(async (): Promise<UserLocation> => {
    if (locationInput.trim()) {
      const geocoded = await geocodeAddress(locationInput.trim());
      if (geocoded) {
        setLocationLabel(locationInput.trim());
        return geocoded;
      }
    }
    setLocationLabel(null);
    return getBrowserLocation();
  }, [locationInput, getBrowserLocation]);

  const findHospitals = useCallback(
    async (cachedLocation?: UserLocation) => {
      setLoading(true);
      setError(null);
      try {
        const location = cachedLocation ?? (await resolveLocation());
        cachedLocationRef.current = location;
        setUserLocation(location);

        const response = await fetch(`${API_URL}/api/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            sort_by: sortBy,
            wait_weight: waitWeight,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch recommendations");

        const data: RecommendationResponse = await response.json();
        setHospitals(data.hospitals);
        setSelectedHospital(data.hospitals[0] || null);
        hasResultsRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [sortBy, waitWeight, resolveLocation]
  );

  const runAiAnalysis = useCallback(async () => {
    if (!hospitals.length) return;
    setAiLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitals, sort_by: sortBy }),
      });
      if (!response.ok) throw new Error("AI analysis failed");
      const enriched: HospitalWithScore[] = await response.json();
      setHospitals(enriched);
      // Preserve selected hospital reference with updated reasoning
      setSelectedHospital((prev) =>
        prev ? enriched.find((h) => h.name === prev.name) ?? prev : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }, [hospitals, sortBy]);

  const findHospitalsRef = useRef(findHospitals);
  findHospitalsRef.current = findHospitals;

  // Auto-refresh on sort mode change
  useEffect(() => {
    if (hasResultsRef.current) {
      findHospitalsRef.current(cachedLocationRef.current ?? undefined);
    }
  }, [sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced refresh on weight change (custom mode)
  useEffect(() => {
    if (!hasResultsRef.current || sortBy !== "custom") return;
    const t = setTimeout(
      () => findHospitalsRef.current(cachedLocationRef.current ?? undefined),
      600
    );
    return () => clearTimeout(t);
  }, [waitWeight, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">imPULSE</h1>
            <p className="text-xs text-gray-400">Smart Hospital Finder</p>
          </div>

          {/* Location input */}
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 focus-within:border-blue-500 transition-colors">
              <svg
                suppressHydrationWarning
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Address or postal code (or use GPS)"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && findHospitals()
                }
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
              />
              {locationInput && (
                <button
                  onClick={() => {
                    setLocationInput("");
                    setLocationLabel(null);
                  }}
                  className="text-gray-500 hover:text-gray-300"
                >
                  ×
                </button>
              )}
            </div>
            {locationLabel && (
              <p className="text-xs text-green-400 mt-1 px-1">
                Using: {locationLabel}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => findHospitals()}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {loading ? "Finding..." : "Find Hospitals"}
            </button>

            {hospitals.length > 0 && (
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{aiLoading ? "Analyzing..." : "✦ AI Analysis"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-96 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Sort Controls */}
          <div className="p-4 border-b border-gray-800">
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
              Sort By
            </label>
            <SortControls
              sortBy={sortBy}
              waitWeight={waitWeight}
              onSortChange={setSortBy}
              onWeightChange={setWaitWeight}
            />
          </div>

          {/* Hospital List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            {hospitals.length === 0 && !loading && !error && (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg mb-2">No results yet</p>
                <p className="text-sm">
                  Enter your address and click &quot;Find Hospitals&quot;
                </p>
              </div>
            )}
            {loading && hospitals.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p className="text-sm">Locating hospitals...</p>
              </div>
            )}
            {hospitals.map((hospital) => (
              <HospitalCard
                key={hospital.name}
                hospital={hospital}
                isSelected={selectedHospital?.name === hospital.name}
                onClick={() => setSelectedHospital(hospital)}
              />
            ))}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1">
          {hospitals.length > 0 ? (
            <Map
              hospitals={hospitals}
              userLocation={userLocation}
              selectedHospital={selectedHospital}
              onHospitalSelect={setSelectedHospital}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-900">
              <div className="text-center text-gray-600">
                <div className="text-6xl mb-4">+</div>
                <p className="text-lg">Map will appear here</p>
                <p className="text-sm mt-1">
                  Find hospitals to see them on the map
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
