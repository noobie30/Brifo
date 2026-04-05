import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          "w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-800",
          "placeholder:text-gray-400",
          "transition-colors duration-150 resize-y min-h-[80px]",
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

Textarea.displayName = "Textarea";
