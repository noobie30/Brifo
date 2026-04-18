// Brifo — icon set (minimal line, 24×24 viewBox, stroke currentColor).
// Ported from the design handoff. Use these instead of Material Symbols.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({
  size = 16,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
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

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
    <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
  </Svg>
);

export const IconNote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M14 4v5h5" />
    <path d="M8 13h7M8 17h5" />
  </Svg>
);

export const IconMeetings = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="13" height="12" rx="1.5" />
    <path d="M16 10.5l5-2.5v8l-5-2.5" />
  </Svg>
);

export const IconDocuments = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4" />
    <path d="M8 12h8M8 16h6" />
  </Svg>
);

export const IconTasks = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconMic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconVideo = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-2.5v9L16 14" />
  </Svg>
);
export const IconJoin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-7" />
    <path d="M14 12H3M7 8l-4 4 4 4" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="3" />
    <path d="M15 14.5a5.5 5.5 0 0 1 6.5 5.5" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
    <path d="M11 16l4-4-4-4M15 12H3" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12l5 5L20 7" />
  </Svg>
);
export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </Svg>
);
export const IconCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
  </Svg>
);
export const IconAlertTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l10 17H2L12 3z" />
    <path d="M12 10v5M12 18v0.5" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v0.5M11 12h1v5h1" />
  </Svg>
);
export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4l1.8 4.7L18.5 10.5 13.8 12.3 12 17l-1.8-4.7L5.5 10.5l4.7-1.8L12 4z" />
    <path d="M19 16l0.7 1.8L21.5 18.5l-1.8 0.7L19 21l-0.7-1.8L16.5 18.5l1.8-0.7L19 16z" />
  </Svg>
);
export const IconClipboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="1.5" />
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 16h4" />
  </Svg>
);
export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
  </Svg>
);
export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
  </Svg>
);
export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </Svg>
);
export const IconMoreV = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="19" r="1.4" />
  </Svg>
);
export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1" />
  </Svg>
);
export const IconFolder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
  </Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M15 3v4h4" />
  </Svg>
);
export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3v18" />
    <path d="M5 4h12l-2 4 2 4H5" />
  </Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.6 6.5 20.4l1.1-6.3L3 9.7l6.3-.9L12 3z" />
  </Svg>
);
export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12V4h8l10 10-8 8L3 12z" />
    <circle cx="7" cy="8" r="1.2" />
  </Svg>
);
export const IconJira = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l5 5-5 5-5-5 5-5z" opacity="0.9" />
    <path d="M12 11l5 5-5 5-5-5 5-5z" opacity="0.6" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v12M6 12l6 6 6-6M4 20h16" />
  </Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8 11l8-4M8 13l8 4" />
  </Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L20 8l-4-4L4 16v4z" />
    <path d="M14 6l4 4" />
  </Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4l14 8-14 8V4z" />
  </Svg>
);

/**
 * Brand mark — cream rounded tile with a blue geometric "B" on the left
 * and a solid dot + two radiating arcs on the right (a subtle "listening"
 * nod). Full mark at size ≥ 32; compact (B only) at smaller sizes so
 * inline icons and favicons stay legible.
 *
 * Equal padding on all four sides, equal corner radii.
 */
type BrifoMarkProps = {
  size?: number;
  /** "light" = cream tile + blue glyph (default). "dark" = blue tile + white glyph. */
  tone?: "light" | "dark";
  /** Force-show or hide the audio arcs regardless of size. */
  variant?: "auto" | "compact" | "full";
  /** Legacy: override tile fill. Any value switches to white glyph for contrast. */
  color?: string;
};

export function BrifoMark({
  size = 22,
  tone = "light",
  variant = "auto",
  color,
}: BrifoMarkProps) {
  const isDark = tone === "dark" || !!color;
  const tileFill =
    color ?? (isDark ? "var(--color-accent)" : "var(--color-subtle, #F3F2EE)");
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
          <path
            fill={glyphColor}
            fillRule="evenodd"
            clipRule="evenodd"
            d="M4.6 6.6H9.1A2.6 2.6 0 0 1 9.1 11.8A2.8 2.8 0 0 1 9.1 17.4H4.6V6.6ZM6.6 8.5V9.9H8.9A0.7 0.7 0 0 0 8.9 8.5H6.6ZM6.6 13.5V15.5H9.1A1.0 1.0 0 0 0 9.1 13.5H6.6Z"
          />
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
