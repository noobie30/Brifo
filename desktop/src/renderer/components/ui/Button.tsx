import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "icon"
  | "ghost"
  | "danger"
  | "dangerOutline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-sm hover:shadow-md",
  secondary:
    "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 shadow-sm",
  tertiary: "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300",
  ghost: "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
  icon: "text-gray-500 hover:bg-gray-100 active:bg-gray-200 !p-0",
  danger:
    "bg-error-600 text-white hover:bg-error-500 active:bg-error-700 shadow-sm",
  dangerOutline:
    "bg-white text-error-600 border border-error-200 hover:bg-error-50 active:bg-error-100 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1 rounded",
  md: "h-8 px-3 text-sm gap-1.5 rounded",
  lg: "h-9 px-4 text-sm gap-2 rounded-lg",
};

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 w-7 rounded",
  md: "h-8 w-8 rounded",
  lg: "h-9 w-9 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      block = false,
      loading = false,
      className = "",
      type = "button",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isIcon = variant === "icon";
    const classes = [
      "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500",
      "disabled:opacity-50 disabled:pointer-events-none",
      "cursor-pointer",
      variantStyles[variant],
      isIcon ? iconSizeStyles[size] : sizeStyles[size],
      block ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export type { ButtonProps, ButtonVariant, ButtonSize };
