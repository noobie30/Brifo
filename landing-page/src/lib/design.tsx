// Brifo landing — small design primitives mirrored from the desktop app's
// design system. Keep the landing page deployable on its own: no imports
// from /desktop.

import type { ReactNode, SVGProps } from "react";

// ————————————————————————————————————————————————————————
// Brand mark — cream rounded tile, geometric blue "B" on the left,
// solid dot + two radiating arcs on the right (a subtle nod to
// "listening"). The full mark appears at sizes ≥ 32px; at smaller
// sizes we drop the arcs and show just the B so the favicon and
// inline icons stay legible.
//
// Equal padding on all four sides of the tile (4.6 units in the 24x24
// viewbox), equal corner radii, square tile — "equal from all sides".
// ————————————————————————————————————————————————————————
type BrifoMarkProps = {
  size?: number;
  /**
   * Surface the mark sits on.
   * - "light" (default): cream tile + hairline border, blue glyph.
   * - "dark": solid blue tile, white glyph — for dark backgrounds
   *   where a cream tile would disappear.
   */
  tone?: "light" | "dark";
  /** Force-show or hide the audio arcs regardless of size. */
  variant?: "auto" | "compact" | "full";
  /** Legacy: override tile fill. If set, wins over `tone`. */
  color?: string;
};

export function BrifoMark({
  size = 24,
  tone = "light",
  variant = "auto",
  color,
}: BrifoMarkProps) {
  // Any non-default tile fill (either explicit `color` override or
  // `tone="dark"`) triggers the inverted palette — white glyph on a
  // filled tile — so the mark stays visible on dark / accent surfaces.
  const isDark = tone === "dark" || !!color;
  const tileFill =
    color ??
    (isDark ? "var(--color-accent)" : "var(--color-subtle, #F3F2EE)");
  const tileStroke = isDark ? "transparent" : "var(--color-border, #E6E4DE)";
  const tileStrokeWidth = isDark ? 0 : 0.75;
  const glyphColor = isDark ? "#ffffff" : "var(--color-accent, #2E5BFF)";

  const full = variant === "full" || (variant === "auto" && size >= 32);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="6"
        fill={tileFill}
        stroke={tileStroke}
        strokeWidth={tileStrokeWidth}
      />
      {full ? (
        <>
          {/* B — scooted left to leave room for the arcs */}
          <path
            fill={glyphColor}
            fillRule="evenodd"
            clipRule="evenodd"
            d="M4.6 6.6H9.1A2.6 2.6 0 0 1 9.1 11.8A2.8 2.8 0 0 1 9.1 17.4H4.6V6.6ZM6.6 8.5V9.9H8.9A0.7 0.7 0 0 0 8.9 8.5H6.6ZM6.6 13.5V15.5H9.1A1.0 1.0 0 0 0 9.1 13.5H6.6Z"
          />
          {/* solid dot + two 90° arcs, concentric at (14.5, 12) */}
          <circle cx="14.5" cy="12" r="0.9" fill={glyphColor} />
          <path
            stroke={glyphColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            d="M16.55 9.95A2.9 2.9 0 0 1 16.55 14.05"
          />
          <path
            stroke={glyphColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            d="M17.96 8.54A4.9 4.9 0 0 1 17.96 15.46"
          />
        </>
      ) : (
        // Compact — centered B, no arcs, for favicon / small inline uses.
        <path
          fill={glyphColor}
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 6.5H12.6A2.7 2.7 0 0 1 12.6 11.9A2.8 2.8 0 0 1 12.6 17.5H7V6.5ZM9.2 8.5V10H12.1A0.75 0.75 0 0 0 12.1 8.5H9.2ZM9.2 13.4V15.7H12.4A1.15 1.15 0 0 0 12.4 13.4H9.2Z"
        />
      )}
    </svg>
  );
}

// ————————————————————————————————————————————————————————
// Eyebrow — small uppercase label used above section titles.
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
// Buttons — three variants the landing page needs.
// ————————————————————————————————————————————————————————
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asAnchor?: boolean;
  href?: string;
  download?: boolean;
  rel?: string;
  target?: string;
};

function btnClasses(variant: "primary" | "secondary" | "onDark", size: "md" | "lg") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer";
  const sizing =
    size === "lg" ? "h-[46px] px-6 text-[15px]" : "h-[38px] px-5 text-[13.5px]";
  const byVariant =
    variant === "primary"
      ? "bg-[var(--color-fg)] text-[var(--color-fg-inverse)] hover:bg-black"
      : variant === "secondary"
        ? "bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
        : "bg-white text-[var(--color-fg)] hover:bg-[var(--color-subtle)]";
  return `${base} ${sizing} ${byVariant}`;
}

export function BtnPrimary({
  asAnchor,
  href,
  download,
  rel,
  target,
  children,
  className = "",
  size = "lg",
  ...rest
}: ButtonProps & { size?: "md" | "lg" }) {
  const cls = `${btnClasses("primary", size)} ${className}`.trim();
  if (asAnchor) {
    return (
      <a
        href={href}
        download={download}
        rel={rel}
        target={target}
        className={cls}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function BtnSecondary({
  asAnchor,
  href,
  download,
  rel,
  target,
  children,
  className = "",
  size = "md",
  ...rest
}: ButtonProps & { size?: "md" | "lg" }) {
  const cls = `${btnClasses("secondary", size)} ${className}`.trim();
  if (asAnchor) {
    return (
      <a
        href={href}
        download={download}
        rel={rel}
        target={target}
        className={cls}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function BtnOnDark({
  asAnchor,
  href,
  download,
  rel,
  target,
  children,
  className = "",
  size = "lg",
  ...rest
}: ButtonProps & { size?: "md" | "lg" }) {
  const cls = `${btnClasses("onDark", size)} ${className}`.trim();
  if (asAnchor) {
    return (
      <a
        href={href}
        download={download}
        rel={rel}
        target={target}
        className={cls}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

// ————————————————————————————————————————————————————————
// Line-stroke icons — keep tiny + inlined so the bundle stays small.
// 24×24 viewBox, stroke currentColor, 1.6 weight.
// ————————————————————————————————————————————————————————
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  const { width, height, ...other } = rest;
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...other}
    >
      {children}
    </svg>
  );
}

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);

export const IconMic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </Svg>
);

export const IconVideo = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-2.5v9L16 14" />
  </Svg>
);

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4l1.8 4.7L18.5 10.5 13.8 12.3 12 17l-1.8-4.7L5.5 10.5l4.7-1.8L12 4z" />
    <path d="M19 16l0.7 1.8L21.5 18.5l-1.8 0.7L19 21l-0.7-1.8L16.5 18.5l1.8-0.7L19 16z" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12l5 5L20 7" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

/** Filled Apple logo for Download-for-Mac buttons. */
export function IconApple({
  size = 16,
  className = "",
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
  const { width, height, ...other } = rest;
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...other}
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export function IconInstagram({
  size = 18,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function IconLinkedIn({
  size = 18,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
