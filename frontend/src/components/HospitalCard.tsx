"use client";

import type { HospitalWithScore } from "@/types/hospital";

interface HospitalCardProps {
  hospital: HospitalWithScore;
  isSelected: boolean;
  onClick: () => void;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function HospitalCard({
  hospital,
  isSelected,
  onClick,
}: HospitalCardProps) {
  const rankColor =
    hospital.rank === 1
      ? "border-green-500 bg-green-500/10"
      : hospital.rank <= 3
        ? "border-yellow-500 bg-yellow-500/10"
        : "border-red-500 bg-red-500/10";

  const rankBadgeColor =
    hospital.rank === 1
      ? "bg-green-500"
      : hospital.rank <= 3
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${rankColor} ${
        isSelected ? "ring-2 ring-white/50 scale-[1.02]" : "hover:scale-[1.01]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full ${rankBadgeColor} flex items-center justify-center text-white font-bold text-sm`}
        >
          {hospital.rank}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{hospital.name}</h3>
          <div className="mt-1 grid grid-cols-3 gap-1 text-sm text-gray-300">
            <span>Wait: {hospital.wait_time_label}</span>
            <span>Drive: {formatMinutes(hospital.travel_time_minutes)}</span>
            <span>Total: {formatMinutes(hospital.total_time_minutes)}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {hospital.distance_km}km away
          </div>
          {hospital.ai_reasoning && (
            <div className="mt-2 p-2 rounded bg-purple-500/10 border border-purple-500/30">
              <p className="text-xs font-medium text-purple-300 mb-0.5">AI Analysis</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                {hospital.ai_reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
