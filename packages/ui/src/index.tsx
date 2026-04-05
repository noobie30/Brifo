import React, { PropsWithChildren } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({
  variant = "primary",
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const className =
    variant === "primary"
      ? "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      : "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <button
      {...props}
      className={`${className} ${props.className ?? ""}`.trim()}
    >
      {children}
    </button>
  );
}

export function Card({ children }: PropsWithChildren) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {children}
    </div>
  );
}
