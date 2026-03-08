"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import type { HospitalWithScore, UserLocation } from "@/types/hospital";

interface MapProps {
  hospitals: HospitalWithScore[];
  userLocation: UserLocation | null;
  selectedHospital: HospitalWithScore | null;
  onHospitalSelect: (hospital: HospitalWithScore) => void;
}

const CALGARY_CENTER = { lat: 51.0447, lng: -114.0719 };

// Module-level singleton so the SDK is only loaded once
let _loaderPromise: Promise<void> | null = null;
function ensureMapsLoaded(apiKey: string): Promise<void> {
  if (!_loaderPromise) {
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["marker", "routes"],
    });
    _loaderPromise = loader.load().then(() => undefined);
  }
  return _loaderPromise;
}

export default function Map({
  hospitals,
  userLocation,
  selectedHospital,
  onHospitalSelect,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef =
    useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  // Keep a stable ref to the callback so marker listeners don't go stale
  const onSelectRef = useRef(onHospitalSelect);
  onSelectRef.current = onHospitalSelect;

  const [mapsReady, setMapsReady] = useState(false);

  // Load Google Maps SDK once on mount
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    ensureMapsLoaded(apiKey).then(() => setMapsReady(true));
  }, []);

  // Initialize map (once) and update markers whenever hospitals/location change
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;

    (async () => {
      const { Map: GoogleMap } = (await google.maps.importLibrary(
        "maps"
      )) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;

      // Create the map instance exactly once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new GoogleMap(mapRef.current!, {
          center: userLocation || CALGARY_CENTER,
          zoom: 11,
          mapTypeId: "satellite",
          mapId: "impulse-map",
        });
      }

      const map = mapInstanceRef.current;

      // Clear old markers
      markersRef.current.forEach((m) => {
        m.map = null;
      });
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }

      // User location marker — pulsing blue dot
      if (userLocation) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText =
          "position:relative;width:22px;height:22px;";

        const ping = document.createElement("div");
        ping.className = "marker-ping";
        ping.style.cssText =
          "position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.55);";

        const dot = document.createElement("div");
        dot.style.cssText =
          "position:relative;width:22px;height:22px;border-radius:50%;" +
          "background:#3b82f6;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);";

        wrapper.appendChild(ping);
        wrapper.appendChild(dot);

        userMarkerRef.current = new AdvancedMarkerElement({
          map,
          position: userLocation,
          content: wrapper,
          title: "Your Location",
        });
      }

      // Hospital markers
      hospitals.forEach((hospital) => {
        const isTop = hospital.rank === 1;
        const isMid = hospital.rank <= 3;
        const color = isTop ? "#22c55e" : isMid ? "#eab308" : "#ef4444";
        const pingColor = isTop
          ? "rgba(34,197,94,0.55)"
          : isMid
            ? "rgba(234,179,8,0.55)"
            : "rgba(239,68,68,0.55)";
        const size = isTop ? 42 : 34;

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `position:relative;width:${size}px;height:${size}px;cursor:pointer;`;

        // Only pulse the #1 hospital
        if (isTop) {
          const ping = document.createElement("div");
          ping.className = "marker-ping";
          ping.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${pingColor};`;
          wrapper.appendChild(ping);
        }

        const badge = document.createElement("div");
        badge.style.cssText =
          `position:relative;width:${size}px;height:${size}px;border-radius:50%;` +
          `background:${color};display:flex;align-items:center;justify-content:center;` +
          `color:white;font-weight:700;font-size:${isTop ? 16 : 13}px;` +
          `border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);`;
        badge.textContent = String(hospital.rank);
        wrapper.appendChild(badge);

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: hospital.lat, lng: hospital.lng },
          content: wrapper,
          title: hospital.name,
        });

        marker.addListener("gmp-click", () => {
          onSelectRef.current(hospital);
        });

        markersRef.current.push(marker);
      });
    })();
  }, [mapsReady, hospitals, userLocation]);

  // Draw driving route when a hospital is selected
  useEffect(() => {
    if (!mapsReady || !mapInstanceRef.current) return;

    // Clear previous route
    if (dirRendererRef.current) {
      dirRendererRef.current.setMap(null);
      dirRendererRef.current = null;
    }

    if (!selectedHospital || !userLocation) return;

    // Fit bounds to show both endpoints
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userLocation);
    bounds.extend({ lat: selectedHospital.lat, lng: selectedHospital.lng });
    mapInstanceRef.current.fitBounds(bounds, 80);

    const renderer = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true, // keep our custom markers
      polylineOptions: {
        strokeColor: "#3b82f6",
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    dirRendererRef.current = renderer;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: userLocation,
        destination: { lat: selectedHospital.lat, lng: selectedHospital.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          renderer.setDirections(result);
        }
      }
    );
  }, [mapsReady, selectedHospital, userLocation]);

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
  );
}
