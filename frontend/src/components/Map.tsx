"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import type { HospitalWithScore, UserLocation } from "@/types/hospital";

interface MapProps {
  hospitals: HospitalWithScore[];
  userLocation: UserLocation | null;
  selectedHospital: HospitalWithScore | null;
  onHospitalSelect: (hospital: HospitalWithScore) => void;
}

const CALGARY_CENTER = { lat: 51.0447, lng: -114.0719 };

export default function Map({
  hospitals,
  userLocation,
  selectedHospital,
  onHospitalSelect,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef =
    useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const initMap = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!mapRef.current || !apiKey) return;

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["marker"],
    });

    const google = await loader.load();
    const { Map: GoogleMap } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

    const map = new GoogleMap(mapRef.current, {
      center: userLocation || CALGARY_CENTER,
      zoom: 11,
      mapTypeId: "satellite",
      mapId: "impulse-map",
    });

    googleMapRef.current = map;

    // User location marker
    if (userLocation) {
      const userPin = document.createElement("div");
      userPin.className = "w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg";

      userMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: userLocation,
        content: userPin,
        title: "Your Location",
      });
    }

    // Hospital markers
    hospitals.forEach((hospital) => {
      const markerEl = document.createElement("div");
      markerEl.className = `flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shadow-lg cursor-pointer ${
        hospital.rank === 1
          ? "bg-green-500 w-10 h-10"
          : hospital.rank <= 3
            ? "bg-yellow-500"
            : "bg-red-500"
      }`;
      markerEl.textContent = String(hospital.rank);

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: hospital.lat, lng: hospital.lng },
        content: markerEl,
        title: hospital.name,
      });

      marker.addListener("gmp-click", () => {
        onHospitalSelect(hospital);
      });

      markersRef.current.push(marker);
    });
  }, [hospitals, userLocation, onHospitalSelect]);

  useEffect(() => {
    initMap();
    return () => {
      markersRef.current = [];
      userMarkerRef.current = null;
    };
  }, [initMap]);

  // Pan to selected hospital
  useEffect(() => {
    if (selectedHospital && googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: selectedHospital.lat,
        lng: selectedHospital.lng,
      });
      googleMapRef.current.setZoom(14);
    }
  }, [selectedHospital]);

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
  );
}
