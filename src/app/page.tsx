"use client";

import { useState, useCallback } from "react";
import Map from "@/components/Map";
import HospitalCard from "@/components/HospitalCard";
import SeveritySelector from "@/components/SeveritySelector";
import type {
  HospitalWithScore,
  UserLocation,
  RecommendationResponse,
} from "@/types/hospital";

export default function Home() {
  const [hospitals, setHospitals] = useState<HospitalWithScore[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedHospital, setSelectedHospital] =
    useState<HospitalWithScore | null>(null);
  const [severity, setSeverity] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserLocation = useCallback((): Promise<UserLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          // Fallback to Calgary downtown
          console.warn("Geolocation failed, using Calgary default:", err);
          resolve({ lat: 51.0447, lng: -114.0719 });
        }
      );
    });
  }, []);

  const findHospitals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await getUserLocation();
      setUserLocation(location);

      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          severity,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch recommendations");

      const data: RecommendationResponse = await response.json();
      setHospitals(data.hospitals);
      setSelectedHospital(data.hospitals[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [severity, getUserLocation]);

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">imPULSE</h1>
            <p className="text-sm text-gray-400">
              Smart Hospital Finder - Calgary
            </p>
          </div>
          <button
            onClick={findHospitals}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            {loading ? "Finding..." : "Find Best Hospital"}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-96 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Severity Selector */}
          <div className="p-4 border-b border-gray-800">
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
              Severity Level
            </label>
            <SeveritySelector severity={severity} onChange={setSeverity} />
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
                  Click &quot;Find Best Hospital&quot; to get started
                </p>
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
