interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

const sizeStyles = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
};

const colors = [
  "bg-accent-100 text-accent-700",
  "bg-success-50 text-success-700",
  "bg-warning-50 text-warning-600",
  "bg-error-50 text-error-600",
  "bg-gray-100 text-gray-600",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AvatarStack({
  names,
  max = 3,
  size = "md",
  className = "",
}: AvatarStackProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;

  return (
    <div className={`flex items-center -space-x-1.5 ${className}`}>
      {visible.map((name, i) => (
        <div
          key={i}
          title={name}
          className={`inline-flex items-center justify-center rounded-full font-medium ring-2 ring-white ${sizeStyles[size]} ${colors[i % colors.length]}`}
        >
          {getInitials(name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`inline-flex items-center justify-center rounded-full font-medium ring-2 ring-white bg-gray-200 text-gray-600 ${sizeStyles[size]}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
