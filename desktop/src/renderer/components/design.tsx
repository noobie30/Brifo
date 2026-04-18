// Shared design-system primitives — light theme, Linear/Notion calm.
// Ported from the Brifo design handoff. Consumers should prefer these
// over ad-hoc Tailwind for consistent look across pages.

import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  IconArrowRight,
  IconCheckCircle,
  IconAlertTriangle,
  IconStar,
} from "./icons";

// ————————————————————————————————————————————————————————
// Button
// ————————————————————————————————————————————————————————

type ButtonVariant = "default" | "primary" | "accent" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function DButton({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variantClass = {
    default: "",
    primary: "brifo-btn-primary",
    accent: "brifo-btn-accent",
    ghost: "brifo-btn-ghost",
    danger: "brifo-btn-danger",
  }[variant];
  const sizeClass = {
    sm: "brifo-btn-sm",
    md: "",
    lg: "brifo-btn-lg",
  }[size];
  const composed = ["brifo-btn", variantClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={composed} {...rest}>
      {children}
    </button>
  );
}

// ————————————————————————————————————————————————————————
// Chip
// ————————————————————————————————————————————————————————

type ChipTone = "default" | "accent" | "success" | "warn" | "danger";

export function Chip({
  tone = "default",
  className = "",
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = {
    default: "",
    accent: "brifo-chip-accent",
    success: "brifo-chip-success",
    warn: "brifo-chip-warn",
    danger: "brifo-chip-danger",
  }[tone];
  return (
    <span className={["brifo-chip", toneClass, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

// ————————————————————————————————————————————————————————
// Card
// ————————————————————————————————————————————————————————

export function Card({
  padding = "md",
  className = "",
  children,
}: {
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const padClass = {
    none: "p-0",
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
  }[padding];
  return (
    <div className={["brifo-card", padClass, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

// ————————————————————————————————————————————————————————
// Page header
// ————————————————————————————————————————————————————————

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 px-8 pt-7 pb-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="m-0 text-[24px] font-semibold tracking-[-0.5px] text-fg leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-[13.5px] text-fg-muted max-w-[640px]">
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ————————————————————————————————————————————————————————
// KPI card
// ————————————————————————————————————————————————————————

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconComponent;
  tone?: "default" | "accent" | "success" | "warn";
}) {
  const toneColor = {
    default: "text-fg-muted",
    accent: "text-accent",
    success: "text-success",
    warn: "text-warn",
  }[tone];
  return (
    <div className="brifo-card px-4 py-3.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-2.5">
        {Icon && (
          <span className={`inline-flex ${toneColor}`}>
            <Icon width={12} height={12} />
          </span>
        )}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="text-[28px] font-semibold tracking-[-0.8px] text-fg num">
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-fg-muted">{hint}</div>}
    </div>
  );
}

// ————————————————————————————————————————————————————————
// Eyebrow (section label)
// ————————————————————————————————————————————————————————

export function Eyebrow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`eyebrow ${className}`.trim()}>{children}</div>;
}

// ————————————————————————————————————————————————————————
// Empty inline block
// ————————————————————————————————————————————————————————

export function EmptyInline({
  icon: Icon,
  title,
  hint,
  cta,
}: {
  icon: IconComponent;
  title: ReactNode;
  hint?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-5">
      <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-subtle text-fg-muted">
        <Icon width={18} height={18} />
      </div>
      <div className="text-[13.5px] font-semibold text-fg">{title}</div>
      {hint && (
        <div className="mt-1 text-[12.5px] text-fg-muted max-w-[320px]">
          {hint}
        </div>
      )}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

// ————————————————————————————————————————————————————————
// Avatar stack
// ————————————————————————————————————————————————————————

const AVATAR_COLORS = [
  "#2E5BFF",
  "#0E7B4E",
  "#D97706",
  "#B42318",
  "#5B49D6",
  "#12794F",
];

export function AvatarStack({
  list,
  size = 20,
}: {
  list: Array<{ initials?: string; name?: string }>;
  size?: number;
}) {
  const shown = list.slice(0, 4);
  const overflow = Math.max(0, list.length - shown.length);
  return (
    <div className="flex items-center" style={{ paddingLeft: 0 }}>
      {shown.map((p, i) => (
        <div
          key={i}
          title={p.name ?? p.initials ?? ""}
          className="flex items-center justify-center rounded-full text-white font-semibold mono flex-shrink-0"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.28),
            fontSize: Math.round(size * 0.45),
            background: AVATAR_COLORS[i % AVATAR_COLORS.length],
            border: "2px solid var(--color-surface)",
            letterSpacing: 0.2,
          }}
        >
          {(p.initials ??
            (p.name ?? "")
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("") ??
            "?").toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full text-fg-muted font-semibold mono flex-shrink-0"
          style={{
            width: size,
            height: size,
            marginLeft: -Math.round(size * 0.28),
            fontSize: Math.round(size * 0.42),
            background: "var(--color-muted)",
            border: "2px solid var(--color-surface)",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————
// Priority dot
// ————————————————————————————————————————————————————————

export function PriorityDot({
  priority,
  showLabel = true,
}: {
  priority: "High" | "Medium" | "Low" | "Critical" | string;
  showLabel?: boolean;
}) {
  const color =
    priority === "High" || priority === "Critical"
      ? "#B42318"
      : priority === "Medium"
        ? "#D97706"
        : "#0E7B4E";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-2">
      <span
        className="inline-block rounded-full"
        style={{ width: 8, height: 8, background: color }}
      />
      {showLabel && priority}
    </span>
  );
}

// ————————————————————————————————————————————————————————
// Task type chip (colored tile + glyph)
// ————————————————————————————————————————————————————————

export function TaskTypeChip({
  type,
  size = 18,
}: {
  type: "Task" | "Bug" | "Story" | "Epic" | string;
  size?: number;
}) {
  const { bg, fg, Icon } =
    type === "Bug"
      ? { bg: "#FCE9E6", fg: "#B42318", Icon: IconAlertTriangle }
      : type === "Story"
        ? { bg: "#E5F4EC", fg: "#0E7B4E", Icon: IconStar }
        : type === "Epic"
          ? { bg: "#ECE8FB", fg: "#5B49D6", Icon: IconStar }
          : {
              bg: "var(--color-accent-soft)",
              fg: "var(--color-accent)",
              Icon: IconCheckCircle,
            };
  return (
    <span
      title={type}
      className="inline-flex items-center justify-center rounded-[4px] flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
      }}
    >
      <Icon width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} />
    </span>
  );
}

// ————————————————————————————————————————————————————————
// ActionRow — used on Dashboard quick-actions card
// ————————————————————————————————————————————————————————

export function ActionRow({
  icon: Icon,
  title,
  hint,
  primary = false,
  onClick,
}: {
  icon: IconComponent;
  title: ReactNode;
  hint?: ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors cursor-pointer hover:bg-subtle"
      style={
        primary
          ? {
              background: "var(--color-accent-soft)",
              border: "1px solid transparent",
            }
          : undefined
      }
    >
      <span
        className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
        style={{
          width: 32,
          height: 32,
          background: primary ? "var(--color-accent)" : "var(--color-subtle)",
          color: primary ? "white" : "var(--color-fg-2)",
        }}
      >
        <Icon width={15} height={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] font-medium truncate"
          style={{ color: primary ? "var(--color-accent)" : "var(--color-fg)" }}
        >
          {title}
        </div>
        {hint && (
          <div className="text-[11.5px] text-fg-muted truncate">{hint}</div>
        )}
      </div>
      <IconArrowRight
        width={13}
        height={13}
        style={{
          color: primary ? "var(--color-accent)" : "var(--color-fg-subtle)",
        }}
      />
    </button>
  );
}

// ————————————————————————————————————————————————————————
// Card header (used inside cards for "Title + actions" bar)
// ————————————————————————————————————————————————————————

export function CardHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
      <div className="text-[13px] font-semibold text-fg">{title}</div>
      {meta && (
        <div className="text-[11.5px] text-fg-subtle mono">{meta}</div>
      )}
      <div className="flex-1" />
      {actions}
    </div>
  );
}
