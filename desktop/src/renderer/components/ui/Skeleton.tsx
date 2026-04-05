interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: "text" | "circle" | "rect";
}

export function Skeleton({
  className = "",
  width,
  height,
  variant = "text",
}: SkeletonProps) {
  const variantClass =
    variant === "circle"
      ? "rounded-full"
      : variant === "rect"
        ? "rounded-lg"
        : "rounded-md";

  const defaultHeight = variant === "text" ? "h-4" : "";

  return (
    <div
      className={`animate-pulse bg-gray-200 ${variantClass} ${defaultHeight} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}
