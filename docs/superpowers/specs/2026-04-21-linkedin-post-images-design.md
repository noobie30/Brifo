# LinkedIn Beta Launch Post Images — Design Spec

**Date:** 2026-04-21  
**Status:** Approved

## Context

Brifo is running a 7-day LinkedIn beta registration campaign. The `marketing/linkedin-posts/` directory is currently empty. This spec covers generating all required post images as 1200×627px PNGs using a Puppeteer script that renders branded HTML templates.

Instagram equivalents already exist in `marketing/instagram-posts/` (square format). LinkedIn images follow the same brand system but use landscape format.

## Brand System

- **Background:** `#F3F2EE` (cream) for standard cards; `#2E4FD9` (blue) for CTA/urgency cards
- **Accent blue:** `#2E4FD9`
- **Text dark:** `#16150f`
- **Text muted:** `#9a988e`, `#6f6d63`
- **Fonts:** Instrument Serif (headlines), Geist / system-ui (body)
- **Logo:** `landing-page/src/assets/brifo-logo-mark.png` — embedded as base64 in every template
- **Output size:** 1200×627px (LinkedIn native landscape)

## Image Inventory — 13 files total

| File | Day | Description |
|------|-----|-------------|
| `day1-hero.png` | 1 | Cream bg · logo + "Beta now open." · app mockup sidebar |
| `day3-slide1.png` | 3 | Cream · "Why Brifo doesn't use a meeting bot." headline |
| `day3-slide2.png` | 3 | Cream · Big blue "0" stat · "bots in the call" |
| `day3-slide3.png` | 3 | Cream · UI mockup (meeting detected) · copy col |
| `day3-slide4.png` | 3 | Blue · "Notes without intrusion." · CTA pill |
| `day4-slide1.png` | 4 | Cream · "From meeting to Jira in 3 taps." |
| `day4-slide2.png` | 4 | Cream · UI mockup (tasks list, action items drafted) |
| `day4-slide3.png` | 4 | Cream · UI mockup (approve & push to Jira button) |
| `day4-slide4.png` | 4 | Cream · Big stat: "2 taps to approve" |
| `day4-slide5.png` | 4 | Cream · "No more who was going to own that?" quote |
| `day4-slide6.png` | 4 | Blue · CTA · "Beta open → [FORM LINK]" |
| `day6-story.png` | 6 | Cream · "12" big stat · build story · no founder photo |
| `day7-lastcall.png` | 7 | Blue bg · "Beta closes tonight." · CTA pill |

Days 2 and 5 are text-only posts — no image needed.

## Architecture

```
marketing/
  linkedin-posts/          ← output PNGs land here
  linkedin-templates/      ← HTML source files (one per image)
    shared/
      logo.js              ← exports LOGO_DATA_URI (base64 PNG)
      styles.css           ← shared brand CSS (fonts, colors, mac-window)
    day1-hero.html
    day3-slide1.html … day3-slide4.html
    day4-slide1.html … day4-slide6.html
    day6-story.html
    day7-lastcall.html
  generate.js              ← Puppeteer script: renders each template → PNG
```

## Template Structure (all templates)

Each HTML template is a self-contained full-document that:
1. Uses `{{LOGO}}` as a placeholder where the base64 data URI will be injected
2. Sets `body` to exactly `1200×627px` with `overflow:hidden`
3. Uses the approved card layout (see Designs section below)

Templates do **not** load external files — `generate.js` injects the logo at render time using `page.setContent()`, avoiding `file://` CORS restrictions entirely.

## generate.js — Puppeteer Script

```js
// Usage: node marketing/generate.js
// Requires: npm install puppeteer (dev dep, added to root package.json)
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = path.join(__dirname, 'linkedin-templates');
const OUTPUT_DIR = path.join(__dirname, 'linkedin-posts');
const LOGO_PATH = path.join(__dirname, '../landing-page/src/assets/brifo-logo-mark.png');
const WIDTH = 1200, HEIGHT = 627;

const templates = [
  'day1-hero',
  'day3-slide1', 'day3-slide2', 'day3-slide3', 'day3-slide4',
  'day4-slide1', 'day4-slide2', 'day4-slide3', 'day4-slide4', 'day4-slide5', 'day4-slide6',
  'day6-story',
  'day7-lastcall',
];

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const logoB64 = fs.readFileSync(LOGO_PATH).toString('base64');
  const logoUri = `data:image/png;base64,${logoB64}`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  for (const name of templates) {
    const raw = fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf8');
    const html = raw.replaceAll('{{LOGO}}', logoUri);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${name}.png`),
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`✓ ${name}.png`);
  }

  await browser.close();
  console.log(`\nDone — ${templates.length} images in marketing/linkedin-posts/`);
})();
```

`deviceScaleFactor: 2` produces @2x retina output; the saved PNG is 1200×627 logical pixels.

## Card Designs

### Standard card layout (cream bg)
- Background: `#F3F2EE`
- Padding: `80px 112px` (at 1200px, halved from preview)
- Slide number label: `8px`, `#2E4FD9`, `letter-spacing: 0.14em`, uppercase
- Headline: Instrument Serif, `36–48px`, `#16150f`
- Body copy: 13px, `#6f6d63`, line-height 1.65
- Bottom-left wordmark: logo (16px) + "Brifo" 700 weight
- Right arrow (carousel only): `#9a988e`, absolute bottom-right

### Blue CTA card
- Background: `#2E4FD9`
- All text white or `rgba(255,255,255,0.6)`
- CTA pill: white bg, `#2E4FD9` text, `border-radius: 100px`
- Logo: `filter: brightness(10)` (renders white)

### UI mockup panel
- Mac chrome window: white bg, `#e6e4de` border, traffic-light dots
- Live meeting row: `#2E4FD9` bg, white text
- Captured row: `#f3f2ee` bg, green badge
- Approve button: `#2E4FD9` bg, white text

## Verification

```bash
# Install puppeteer (once)
npm install puppeteer --save-dev

# Generate all images
node marketing/generate.js

# Check output
ls -la marketing/linkedin-posts/
# Expect 13 PNG files, each ~200–600KB
```

Open any PNG in Preview to confirm 1200×627px at 2x DPI. Check logo renders correctly on both cream and blue backgrounds.
