import { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-error-600">{error}</span>}
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );
}
