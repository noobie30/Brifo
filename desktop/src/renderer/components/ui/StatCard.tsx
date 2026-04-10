import { ReactNode } from "react";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold text-gray-900">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium mb-0.5 ${
              trendUp ? "text-success-600" : "text-gray-400"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
