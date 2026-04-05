import { HTMLAttributes } from "react";

export function SurfaceCard({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  const classes = ["surface-card", className ?? ""].filter(Boolean).join(" ");

  return <section className={classes} {...props} />;
}
