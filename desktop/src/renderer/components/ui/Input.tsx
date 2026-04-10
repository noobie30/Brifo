import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          "h-9 w-full rounded-md border bg-white px-3 text-sm text-gray-800",
          "placeholder:text-gray-400",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-400",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error
            ? "border-error-500 focus:ring-error-500 focus:border-error-500"
            : "border-gray-200 hover:border-gray-300",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
