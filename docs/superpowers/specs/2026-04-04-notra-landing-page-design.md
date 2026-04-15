# Brifo Landing Page Redesign — Design Spec

## Context

The current Brifo landing page (`landing-page`) is a basic single-page marketing site built with React 19 + Vite and custom CSS. It needs a redesign inspired by duna.com — clean, minimal, whitespace-heavy, and professional. The goal is to drive Mac app downloads as the primary CTA with sign-in as secondary.

## Tech Stack

- **React 19 + Vite** (existing)
- **Tailwind CSS v4** — add as new dependency, replace custom `styles.css`
- **CSS scroll-triggered animations** — using `@keyframes` + Intersection Observer (no Framer Motion to keep it lightweight)
- **No routing** — single-page landing with anchor-scroll navigation

## Color Scheme

Monochrome with high contrast:

| Token              | Value     | Usage                                 |
| ------------------ | --------- | ------------------------------------- |
| `--bg-primary`     | `#ffffff` | Hero, how-it-works backgrounds        |
| `--bg-secondary`   | `#fafafa` | Features, privacy section backgrounds |
| `--bg-dark`        | `#111111` | Final CTA, footer                     |
| `--text-primary`   | `#111111` | Headlines                             |
| `--text-secondary` | `#666666` | Body text, subtitles                  |
| `--text-muted`     | `#999999` | Labels, captions                      |
| `--border`         | `#e0e0e0` | Card borders, dividers                |

## Typography

- **Font family**: Inter (with system-ui fallback)
- **Hero headline**: 52px, weight 700, letter-spacing -1.5px
- **Section headlines**: 36px, weight 700, letter-spacing -1px
- **Card titles**: 18px, weight 650
- **Body text**: 14-16px, weight 400, line-height 1.7
- **Labels**: 12px, uppercase, letter-spacing 2px, weight 600

## Page Sections (top to bottom)

### 1. Header (sticky)

- **Layout**: Flex row, space-between, padded 16px 48px
- **Left**: Logo wordmark "brifo" (bold, 18px) + nav links (Features, How it works, Privacy)
- **Right**: "Sign in" text link + "Download for Mac" solid black button (rounded 8px)
- **Behavior**: Sticky on scroll with `backdrop-filter: blur(12px)` and `background: rgba(255,255,255,0.8)`
- **Border**: 1px solid #f0f0f0 bottom border
- **Nav links**: Smooth anchor-scroll to corresponding sections via `scroll-behavior: smooth`

### 2. Hero

- **Layout**: Centered text, max-width 720px, padding 100px top / 80px bottom
- **Badge**: Pill-shaped ("AI-powered meeting workspace"), 12px text, border 1px solid #e0e0e0, border-radius 20px
- **Headline**: "Meeting notes that write themselves" — 52px, bold, tight line-height (1.1)
- **Subtitle**: "Brifo captures your meetings, generates intelligent notes, and extracts action items — all without an awkward bot joining your call." — 18px, #666
- **CTAs**: Two buttons side by side
  - Primary: "Download for Mac" — black bg, white text, rounded 10px, 15px font
  - Secondary: "Sign in" — #f5f5f5 bg, #333 text, rounded 10px
- **Animation**: Fade-in + slight slide-up on page load (opacity 0→1, translateY 20px→0, 0.6s ease-out)

### 3. Features

- **Background**: #fafafa
- **Section label**: "WHY BRIFO" — 12px uppercase, #999
- **Section headline**: "Everything your meetings need" — 36px
- **Layout**: 3-column CSS grid, gap 20px
- **Cards**: White background, border-radius 14px, 1px solid #eee border, padding 32px 28px
  - **Icon**: 44x44px container with #f5f5f5 background, border-radius 10px, emoji or SVG icon
  - **Title**: 18px, bold
  - **Description**: 14px, #666
- **Card content**:
  1. **Signal-aware notes** (🎯) — AI identifies key decisions, action items, and important moments
  2. **Tasks from meetings** (✅) — Auto-extracted action items, Jira integration
  3. **Built for Mac** (🍎) — Native macOS, auto-detects meetings, local audio capture
- **Animation**: Cards fade-in with stagger (each card delays 100ms after previous) triggered on scroll into view
- **Responsive**: Stacks to single column below 768px

### 4. How It Works

- **Background**: #ffffff
- **Section label**: "HOW IT WORKS" — 12px uppercase, #999
- **Section headline**: "Three steps. Zero effort." — 36px
- **Layout**: 3-column grid, centered, max-width 900px
- **Steps**: Each centered with:
  - Numbered circle: 56px, black bg, white text, bold 22px, border-radius 50%
  - Title: 17px, bold
  - Description: 14px, #666
- **Step content**:
  1. **Open Brifo** — Launch the app, runs in menu bar, auto-detects meetings
  2. **Have your meeting** — Works on Zoom, Google Meet, any platform, no bot joins
  3. **Get your notes** — AI notes, action items, and transcript ready when meeting ends
- **Connector**: Subtle horizontal line between step circles (2px, #e0e0e0 with gradient fade)
- **Animation**: Steps animate in sequentially (1→2→3) on scroll, 150ms stagger
- **Responsive**: Stacks vertically on mobile with vertical connector line

### 5. Privacy

- **Background**: #fafafa
- **Layout**: Centered text, max-width 600px, padding 60px
- **Section label**: "PRIVACY FIRST" — 12px uppercase
- **Headline**: "No bots. No awkward intros." — 36px
- **Body**: "Brifo captures audio directly from your Mac — nothing joins your call, nothing records your screen. Your meetings stay private, your colleagues stay comfortable." — 16px, #666
- **Animation**: Fade-in on scroll

### 6. Final CTA

- **Background**: #111111
- **Layout**: Centered text, max-width 560px, padding 80px
- **Headline**: "Ready to try Brifo?" — 40px, white
- **Subtitle**: "Download the Mac app and let your next meeting take notes for you." — 16px, #999
- **CTAs**:
  - Primary: "Download for Mac" — white bg, #111 text, rounded 10px, font-weight 600
  - Secondary: "Sign in" — transparent bg, white text, 1px solid #444 border
- **Animation**: Fade-in on scroll

### 7. Footer

- **Background**: #111111 (continues from CTA section — no gap)
- **Border-top**: 1px solid #222 to subtly separate from CTA
- **Layout**: Single flex row, space-between, padding 32px 48px
- **Left**: Logo "brifo" (white, 16px bold) + links (Features, Privacy, Support) in #666, 13px
- **Right**: "© 2026 Brifo. All rights reserved." in #444, 13px
- **Responsive**: Stacks to centered column on mobile

## Animations Strategy

All animations use CSS `@keyframes` + a lightweight Intersection Observer hook (`useInView`):

```
// Hook pattern (no library needed):
// - Observes element ref
// - Adds `.in-view` class when element enters viewport
// - threshold: 0.15 (triggers when 15% visible)
// - triggerOnce: true
```

Animation classes:

- `.fade-up` — opacity 0→1, translateY 20px→0, 0.6s ease-out
- `.fade-up-delay-1` — same + 100ms delay
- `.fade-up-delay-2` — same + 200ms delay
- `.stagger-children > *:nth-child(n)` — automatic stagger based on child index

## File Structure

```
landing-page/
├── index.html                 (update title/meta tags)
├── package.json               (add tailwind dependencies)
├── tailwind.config.ts         (new — Tailwind config)
├── postcss.config.js          (new — PostCSS for Tailwind)
├── src/
│   ├── main.tsx               (unchanged)
│   ├── App.tsx                (rewrite — compose sections)
│   ├── styles.css             (rewrite — Tailwind directives + custom animations)
│   ├── hooks/
│   │   └── useInView.ts       (new — Intersection Observer hook)
│   ├── components/
│   │   ├── Header.tsx         (new)
│   │   ├── Hero.tsx           (new)
│   │   ├── Features.tsx       (new)
│   │   ├── HowItWorks.tsx     (new)
│   │   ├── Privacy.tsx        (new)
│   │   ├── CallToAction.tsx   (new)
│   │   └── Footer.tsx         (new)
│   └── assets/                (existing logos)
```

## Responsive Breakpoints

- **Desktop**: ≥1024px — full layout as designed
- **Tablet**: 768px–1023px — 2-column grids where applicable
- **Mobile**: <768px — single column, reduced padding, smaller typography (hero 36px, sections 28px)

## Verification Plan

1. `npm run typecheck` — no TypeScript errors
2. `cd landing-page && npm run dev` — dev server starts on port 5174
3. Visual check: all 7 sections render correctly at desktop, tablet, and mobile widths
4. Scroll animations trigger correctly on each section
5. Nav links smooth-scroll to correct sections
6. Download and Sign in buttons use correct `VITE_DOWNLOAD_URL` env var
7. `npm run build` — production build succeeds
