"use client";

interface SeveritySelectorProps {
  severity: string;
  onChange: (severity: string) => void;
}

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", description: "Minor issue, not urgent", color: "bg-green-600" },
  { value: "medium", label: "Medium", description: "Needs attention soon", color: "bg-yellow-600" },
  { value: "high", label: "High", description: "Urgent care needed", color: "bg-orange-600" },
  { value: "critical", label: "Critical", description: "Life-threatening", color: "bg-red-600" },
];

export default function SeveritySelector({ severity, onChange }: SeveritySelectorProps) {
  return (
    <div className="flex gap-2">
      {SEVERITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            severity === option.value
              ? `${option.color} text-white ring-2 ring-white/30`
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
          title={option.description}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
