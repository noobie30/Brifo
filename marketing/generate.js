// Usage: node marketing/generate.js
// Requires: puppeteer (npm install puppeteer --save-dev)
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = path.join(__dirname, 'linkedin-templates');
const OUTPUT_DIR = path.join(__dirname, 'linkedin-posts');
const LOGO_PATH = path.join(__dirname, '../landing-page/src/assets/brifo-logo-mark.png');
const FONT_NORMAL_PATH = path.join(__dirname, 'fonts/instrument-serif-normal.woff2');
const FONT_ITALIC_PATH = path.join(__dirname, 'fonts/instrument-serif-italic.woff2');
const WIDTH = 1200;
const HEIGHT = 627;

const TEMPLATES = [
  'day1-hero',
  'day3-slide1', 'day3-slide2', 'day3-slide3', 'day3-slide4',
  'day4-slide1', 'day4-slide2', 'day4-slide3', 'day4-slide4', 'day4-slide5', 'day4-slide6',
  'day6-story',
  'day7-lastcall',
];

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Encode logo
  const logoB64 = fs.readFileSync(LOGO_PATH).toString('base64');
  const logoUri = `data:image/png;base64,${logoB64}`;

  // Encode fonts
  const fontNormalB64 = fs.readFileSync(FONT_NORMAL_PATH).toString('base64');
  const fontItalicB64 = fs.readFileSync(FONT_ITALIC_PATH).toString('base64');
  const fontCSS = `<style>
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  src: url('data:font/woff2;base64,${fontNormalB64}') format('woff2');
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  src: url('data:font/woff2;base64,${fontItalicB64}') format('woff2');
}
</style>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  for (const name of TEMPLATES) {
    const templatePath = path.join(TEMPLATES_DIR, `${name}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');

    // Inject logo and strip external font links
    html = html.split('{{LOGO}}').join(logoUri);
    html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, '');
    html = html.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, '');
    html = html.replace('<head>', `<head>${fontCSS}`);

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Brief pause to let fonts render
    await new Promise(r => setTimeout(r, 300));

    const outPath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`✓  ${name}.png`);
  }

  await browser.close();
  console.log(`\nDone — ${TEMPLATES.length} images saved to marketing/linkedin-posts/`);
})();
