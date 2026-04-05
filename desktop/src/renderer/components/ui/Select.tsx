import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={[
          "h-9 w-full rounded-md border bg-white px-3 pr-8 text-sm text-gray-800",
          "appearance-none",
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236b7280%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%27%20clip-rule%3D%27evenodd%27%2F%3E%3C%2Fsvg%3E")]',
          "bg-[length:20px] bg-[position:right_6px_center] bg-no-repeat",
          "transition-colors duration-150",
          "focus:outline-2 focus:outline-offset-0 focus:outline-accent-500 focus:border-accent-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error
            ? "border-error-500 focus:outline-error-500 focus:border-error-500"
            : "border-gray-300 hover:border-gray-400",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
