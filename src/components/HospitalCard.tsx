"use client";

import type { HospitalWithScore } from "@/types/hospital";

interface HospitalCardProps {
  hospital: HospitalWithScore;
  isSelected: boolean;
  onClick: () => void;
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
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
            <span>Wait: {hospital.waitTimeLabel}</span>
            <span>Drive: {hospital.travelTimeMinutes}min</span>
            <span>{hospital.distanceKm}km</span>
          </div>
          {hospital.aiReasoning && (
            <p className="mt-2 text-xs text-gray-400 italic">
              {hospital.aiReasoning}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs text-gray-400">Score</div>
          <div className="text-lg font-bold text-white">
            {hospital.priorityScore}
          </div>
        </div>
      </div>
    </button>
  );
}
