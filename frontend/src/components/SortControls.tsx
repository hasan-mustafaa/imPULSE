"use client";

import type { SortMode } from "@/types/hospital";

interface SortControlsProps {
  sortBy: SortMode;
  waitWeight: number;
  onSortChange: (sort: SortMode) => void;
  onWeightChange: (weight: number) => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "shortest_wait", label: "Shortest Wait" },
  { value: "shortest_commute", label: "Shortest Commute" },
  { value: "shortest_total", label: "Shortest Total" },
  { value: "custom", label: "Custom" },
];

export default function SortControls({
  sortBy,
  waitWeight,
  onSortChange,
  onWeightChange,
}: SortControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {SORT_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onSortChange(option.value)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              sortBy === option.value
                ? "bg-blue-600 text-white ring-2 ring-blue-400/30"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sortBy === "custom" && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Commute</span>
            <span>Wait Time</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={waitWeight * 100}
            onChange={(e) => onWeightChange(Number(e.target.value) / 100)}
            className="w-full accent-blue-500"
          />
          <div className="text-center text-xs text-gray-500">
            {Math.round((1 - waitWeight) * 100)}% commute / {Math.round(waitWeight * 100)}% wait
          </div>
        </div>
      )}
    </div>
  );
}
