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
      />
    );
  },
);

Input.displayName = "Input";
