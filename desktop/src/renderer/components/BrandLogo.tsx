import brifoLogoMark from "../assets/brifo-logo-mark.png";

interface BrandLogoProps {
  compact?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export function BrandLogo({
  compact = false,
  showSubtitle = false,
  className = "",
}: BrandLogoProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <img
          src={brifoLogoMark}
          alt="Brifo logo mark"
          className={compact ? "h-6 w-6" : "h-7 w-7"}
        />
        <span className="text-lg font-bold text-gray-900 tracking-tight">
          Brifo
        </span>
      </div>
    </div>
  );
}
