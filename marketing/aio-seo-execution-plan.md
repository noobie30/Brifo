# Brifo AI/SEO Discoverability — 4-Week Execution Plan

**Goal:** when someone asks ChatGPT / Claude / Perplexity about "Brifo," they return info about **our Brifo** (AI meeting app on brifo.in), not Brifo Logistics / Brifo Infrabuild.

**Key insight:** trained LLMs can't be retrofitted. What's achievable in 4 weeks is winning **real-time web search** (Perplexity, ChatGPT Search, Claude web-search, Gemini) by ranking top-3 on Google/Bing for "Brifo" queries AND having 8+ reinforcing third-party citations.

On-site work is already done (see `landing-page/` changes — enriched JSON-LD, disambiguation, 7 new pages, expanded robots.txt, llms.txt, llms-full.txt). This doc is the **off-site execution checklist** — the part that only you can do.

---

## Week 1 — High-leverage launches (do these first)

### ☐ 1.1 — Make GitHub repo public and polish (2 hours, DAY 1)

Repo: `github.com/noobie30/Brifo` (implied by download URL)

Actions:
- [ ] Confirm repo is **public** (not private)
- [ ] Rewrite the repo's About/Description (the one-liner at the top): *"Brifo — AI-powered meeting notes for macOS. Automatic meeting capture without a bot joining your call. Works with Zoom, Google Meet, Teams, Slack Huddles, Discord. https://brifo.in"*
- [ ] Add repo topics (Settings → Topics): `ai`, `meeting-notes`, `macos`, `electron`, `transcription`, `zoom`, `google-meet`, `microsoft-teams`, `productivity`, `react`, `nestjs`, `typescript`, `ai-meeting-assistant`, `otter-alternative`, `granola-alternative`, `fireflies-alternative`
- [ ] Add the website field in repo settings → `https://brifo.in`
- [ ] Pin the Releases section
- [ ] Replace root README.md with the draft below (section 1.1a)
- [ ] Add a high-res GIF or screenshot at the top of the README showing Brifo in action
- [ ] Request Star: post the repo link to your X + LinkedIn with a one-liner, ask friends to star

**Why it matters:** GitHub is crawled aggressively by every AI. A public repo with "Brifo" in name, description, topics, and keyword-rich README is a fast citation.

#### 1.1a — GitHub README.md draft

```markdown
# Brifo — AI Meeting Notes for Mac

**Brifo** is an AI-powered meeting notes application for macOS. It auto-captures your meetings on any platform (Zoom, Google Meet, Microsoft Teams, Slack Huddles, Discord) and turns them into structured notes, action items, and follow-up emails — **without a bot joining the call**.

> **Note:** Brifo (this AI meeting app) is not affiliated with Brifo Logistics Pvt Ltd or Brifo Infrabuild Services Pvt Ltd — those are unrelated Indian logistics companies with similar names.

**Download:** https://brifo.in
**Website:** https://brifo.in
**API:** https://api.brifo.in

---

## Why Brifo

- **No bot joins your call.** Brifo captures system audio locally on your Mac. Your participants see nothing unusual.
- **Auto-detects meetings.** Don't remember to press Start. Brifo notices when a meeting begins and captures automatically.
- **AI-powered notes.** Structured summaries with key decisions, action items, and suggested follow-up emails.
- **One-click Jira filing.** Extracted action items become Jira tickets in one click.
- **Privacy-first.** Audio is processed locally and never uploaded. Only the transcript goes to the cloud.

## How it compares

- [Brifo vs Otter.ai](https://brifo.in/compare/brifo-vs-otter)
- [Brifo vs Granola](https://brifo.in/compare/brifo-vs-granola)
- [Brifo vs Fireflies.ai](https://brifo.in/compare/brifo-vs-fireflies)

## Tech

Electron 33 + React 19 desktop app, NestJS 10 cloud API, MongoDB, OpenAI GPT-4.1 for AI note generation, Google Calendar + Jira OAuth integrations.

## Install

Download the latest release: [Releases →](https://github.com/noobie30/Brifo/releases)

Requirements: macOS 13 (Ventura) or newer, Apple Silicon (M1/M2/M3/M4).

## Links

- [brifo.in](https://brifo.in) · [About](https://brifo.in/about) · [Privacy](https://brifo.in/privacy) · [Terms](https://brifo.in/terms)
- [LinkedIn](https://linkedin.com/company/brifoapp) · [Instagram](https://instagram.com/brifo.in)
- [llms.txt](https://brifo.in/llms.txt) (for AI agents) · [API docs](https://api.brifo.in/api/docs)
```

### ☐ 1.2 — Launch on Product Hunt (DAY 2–3)

- [ ] Launch the PH page using your existing marketing drafts (you have them prepped in `marketing/`)
- [ ] Title suggestion: **"Brifo — AI meeting notes without bots, for Mac"**
- [ ] Tagline: **"Auto-captures every meeting on your Mac. No bot joins the call."**
- [ ] Make sure PH description includes: "Brifo is an AI meeting notes app for macOS" (not just "Brifo")
- [ ] Include links to brifo.in, GitHub, and 2-3 comparison pages
- [ ] Recruit 20-30 upvotes from your network in the first 4 hours

**Why:** Product Hunt pages rank high on Google for the product name and are crawled by ChatGPT, Claude, and Perplexity within days.

### ☐ 1.3 — Show HN (DAY 3, Monday 9 AM Pacific)

- [ ] Submit draft from `marketing/showhn-launch.md`
- [ ] Title: *"Show HN: Brifo – AI meeting notes for Mac, no bot joins the call"*
- [ ] Respond to every comment within 10 minutes for the first 2 hours

**Why:** HN threads are heavily crawled. Even a mid-tier HN performance (50–150 upvotes) gets you into AI responses.

### ☐ 1.4 — Submit sitemap + verify crawl signals (DAY 1, 30 min)

- [ ] Sign into Google Search Console (if not already). Verify `brifo.in` with DNS TXT or Vercel integration.
- [ ] Submit `https://brifo.in/sitemap.xml`
- [ ] Request indexing on:
  - `https://brifo.in`
  - `https://brifo.in/about`
  - `https://brifo.in/compare/brifo-vs-otter`
  - `https://brifo.in/compare/brifo-vs-granola`
  - `https://brifo.in/compare/brifo-vs-fireflies`
- [ ] Sign into Bing Webmaster Tools. Verify domain. Submit sitemap. (Bing → powers ChatGPT Search.)
- [ ] Run https://search.google.com/test/rich-results on the homepage — confirm all 5 schemas validate with no errors.
- [ ] Run https://validator.schema.org/ on the homepage — zero errors expected.

---

## Week 2 — Indie Hackers, Reddit, AlternativeTo

### ☐ 2.1 — Indie Hackers (1 hour, DAY 8)

- [ ] Post using `marketing/indiehackers-launch.md`
- [ ] Title: *"I built Brifo — an AI meeting notes app for Mac with no bot in your call"*
- [ ] Add Brifo to the Indie Hackers product directory: https://www.indiehackers.com/products/submit
- [ ] Link: brifo.in, GitHub, and one comparison page

### ☐ 2.2 — Reddit launches (3 hours spread across the week)

Post order (wait 24h between posts, don't burn out karma):

- [ ] DAY 8 — **r/macapps** — adapted copy from `marketing/reddit-posts.md` with Mac-specific framing
- [ ] DAY 10 — **r/productivity** — lead with the "no bot" wedge
- [ ] DAY 11 — **r/sideproject** — lead with the founder story
- [ ] DAY 12 — **r/SaaS** — frame as a launch
- [ ] DAY 13 — **r/Entrepreneur** — small post with lesson-learned angle
- [ ] DAY 14 — **r/IndieHackers** — mirror IH post

**Indian subs (given India-priority):**
- [ ] DAY 9 — **r/developersIndia** — founder-story framing
- [ ] DAY 11 — **r/IndianStartups**
- [ ] DAY 13 — **r/india** (be careful — general audience; only if you have a compelling hook)

Every Reddit post must:
- Include "brifo.in" as a plain-text link (not a markdown link; Reddit strips these sometimes)
- Include one line explicitly disambiguating: *"(Brifo the AI meeting app — unrelated to Brifo Logistics.)"*
- Follow the sub's self-promo rules (most cap at 10% self-promo content)

**Why Reddit matters:** Reddit threads are cited by Perplexity and ChatGPT with search more than almost any other domain. One high-quality thread beats ten low-effort ones.

### ☐ 2.3 — AlternativeTo (1 hour, DAY 10)

- [ ] Submit Brifo at https://alternativeto.net/new-app/
- [ ] Describe as an alternative to: Otter.ai, Fireflies.ai, Granola, Fathom, Fellow.app
- [ ] Upload a screenshot
- [ ] Tags: "meeting-transcription", "ai-notes", "macos", "productivity"

**Why:** AlternativeTo is the go-to citation for AI responses to "alternatives to X." One listing gets you cited for half a dozen queries.

### ☐ 2.4 — AI crawl sanity check (DAY 14, 15 min)

- [ ] Open https://chat.openai.com → enable Search → ask *"What is Brifo the Mac app?"* — note answer and citations
- [ ] Open https://www.perplexity.ai → ask same question
- [ ] Open https://claude.ai → ask *"Tell me about Brifo, the AI meeting app"*
- [ ] Log results to `marketing/aio-progress.md` (create it) with date + query + answer + citations

**Pass bar for Week 2:** at least one AI returns a correct answer with brifo.in or GitHub as a citation.

---

## Week 3 — Directory blitz + LinkedIn + India-specific

### ☐ 3.1 — Free directory submissions (3 hours, DAY 15–17)

Each takes 5–10 minutes. Do two per day.

- [ ] **Capterra** (free listing): https://vendors.capterra.com/products/new
- [ ] **G2** (free listing): https://sell.g2.com/g2-crowd-product-listings
- [ ] **GetApp**: https://www.getapp.com/vendors/
- [ ] **Slashdot/SourceForge**: https://slashdot.org/software/submit.pl
- [ ] **BetaList**: https://betalist.com/submit
- [ ] **StartupStash**: https://startupstash.com/submit
- [ ] **SaaSHub**: https://www.saashub.com/contribute
- [ ] **LaunchingNext**: https://www.launchingnext.com/submit/
- [ ] **UneedUs (Uneed.best)**: https://www.uneed.best/submit
- [ ] **TinyStartups**: https://tinystartups.com/submit
- [ ] **ToolFinder**: https://www.toolfinder.co/submit
- [ ] **StackShare**: https://stackshare.io/companies/new (software stack angle)
- [ ] **macupdate.com** (for Mac apps): https://www.macupdate.com/app/submit
- [ ] **applealmond.com / allthingsd Mac directories** (if they accept submissions)

For each, use:
- Short description: *"Brifo — AI meeting notes for Mac. Auto-captures every meeting. No bot joins your call."*
- Category: Productivity / Business / Meeting Software / Transcription
- Tags: AI, macOS, meeting notes, transcription, Otter alternative, Granola alternative
- URL: https://brifo.in
- Logo: use favicon.png

### ☐ 3.2 — LinkedIn company page + launch posts (1 hour, DAY 15)

- [ ] If `linkedin.com/company/brifoapp` doesn't exist, create it. (Footer currently links there — make sure it's live.)
- [ ] Fill: tagline, about (reuse /about content), website, industry (Computer Software), company size.
- [ ] Publish the launch post from `marketing/linkedin-beta-launch.md`
- [ ] Founder profile: ensure Brifo is listed as current role, link to brifo.in in profile

### ☐ 3.3 — Twitter/X presence (30 min initial, ongoing)

- [ ] Lock handle: try `@brifoapp` or `@brifo_app` or `@brifoai`
- [ ] Bio: *"AI meeting notes for Mac 🎙 No bot joins your call. brifo.in"*
- [ ] Pinned tweet: launch announcement with link + screenshot
- [ ] Post daily for two weeks using drafts from `marketing/twitter-beta-launch.md`

### ☐ 3.4 — India-specific citations (2 hours, DAY 18–21)

- [ ] **YourStory** — pitch founder story via https://yourstory.com/startup-pitch (free submission)
- [ ] **Inc42** — submit startup via https://inc42.com/submit-your-startup/
- [ ] **NASSCOM Products Council catalog** — https://products.nasscom.in (requires NASSCOM membership tier but free basic listing exists)
- [ ] **TechStory.in** — press release submission
- [ ] **Startupindia.gov.in** — register Brifo as a startup (free) — gets you on gov.in indexed database
- [ ] **ProductLift / India Made Products directories**

### ☐ 3.5 — Quora answers (ongoing, 30 min per answer)

Find and answer these questions honestly (with Brifo mentioned once per answer, not spammed):
- [ ] "What's the best AI meeting notes tool for Mac?"
- [ ] "Are there alternatives to Otter.ai that don't use a bot?"
- [ ] "Is there a Mac-native alternative to Granola?"
- [ ] "How do I capture Zoom meetings without a bot?"
- [ ] "What's the best privacy-first meeting transcription tool?"

Quora answers are scraped by AIs and rank well on Google for long-tail queries.

---

## Week 4 — Reinforce, respond, measure

### ☐ 4.1 — Re-run AI query tests (DAY 22, 30 min)

In clean/anonymous browser sessions (not signed in, no personalization):

| Query | Expected result | Pass? |
|---|---|---|
| Perplexity: "What is Brifo?" | Brifo AI meeting app cited from brifo.in | ☐ |
| Perplexity: "Brifo Mac app" | brifo.in is #1 citation | ☐ |
| Perplexity: "Brifo AI meeting notes" | brifo.in is #1 | ☐ |
| ChatGPT + Search: "What is Brifo? Is it a meeting app or a logistics company?" | Correct disambiguation, brifo.in cited | ☐ |
| ChatGPT + Search: "Brifo vs Otter" | /compare/brifo-vs-otter cited | ☐ |
| Claude (Web search): "Tell me about Brifo, the AI meeting notes app" | Full product description from brifo.in | ☐ |
| Gemini: "Brifo AI meeting app reviews" | brifo.in + Product Hunt + Reddit | ☐ |
| Google: "Brifo" | brifo.in top 3 | ☐ |
| Google: "Brifo app" | brifo.in #1 | ☐ |
| Google: "Brifo vs Otter" | /compare/brifo-vs-otter #1 | ☐ |

**Pass bar:** ≥ 5 of 10 rows are passing. If you're below 3, loop back and post to 3 more high-authority sites (focus on Reddit + AlternativeTo).

### ☐ 4.2 — Citation count check (DAY 23, 15 min)

Run these `site:` searches on Google and count results:

- [ ] `site:github.com brifo` — your repo should appear
- [ ] `site:producthunt.com brifo` — listing live
- [ ] `site:news.ycombinator.com brifo` — Show HN thread
- [ ] `site:indiehackers.com brifo` — IH product + post
- [ ] `site:reddit.com brifo macapp` — ≥3 threads
- [ ] `site:alternativeto.net brifo` — listing live
- [ ] `site:linkedin.com brifo` — company page + posts
- [ ] `site:capterra.com brifo` or `site:g2.com brifo` — directory listings

**Pass bar:** 8+ of 8 return real results.

### ☐ 4.3 — Set up Google Alerts (DAY 22, 5 min)

- [ ] https://www.google.com/alerts → create alerts for:
  - `"Brifo" meeting`
  - `"Brifo" app`
  - `"Brifo" AI`
  - `site:reddit.com brifo`
- [ ] Respond to every mention within 24 hours — a replied-to mention is 3× more likely to be cited by an AI.

### ☐ 4.4 — If the AI answers are still wrong at end of Week 4

Run this fallback (one hour):
- [ ] Post a LinkedIn carousel titled *"Brifo (the AI meeting app) vs the 2 Indian logistics companies with the same name — here's how to tell them apart"* — this gets indexed and AI models pick up the disambiguation directly.
- [ ] Add "Brifo AI" and "Brifo App" as explicit mentions in the hero H1 (e.g., *"Brifo — the AI meeting app for Mac"*).
- [ ] Submit a direct URL citation to Perplexity via their feedback form: "Perplexity returns results about logistics companies when users search for Brifo; the actual product is at brifo.in."

---

## Non-goals (explicitly skipped — do not do these)

- ❌ **Wikipedia article.** Too early. Would fail notability and get speedy-deleted. Revisit at 6 months.
- ❌ **Paid backlink services.** These get penalized and reverse gains.
- ❌ **Keyword stuffing.** No more than what's already in meta tags.
- ❌ **Fake reviews on G2 / Capterra.** Real reviews only (ask 3-5 beta users directly).

---

## Measuring success (weekly — 15 min per Sunday)

Maintain a `marketing/aio-progress.md` log with:

```
## 2026-04-27 — Week 1 end
- Google "Brifo" — position X
- ChatGPT+Search "Brifo" — [pass/fail, with quote]
- Perplexity "Brifo" — [pass/fail, with quote]
- Claude web-search "Brifo" — [pass/fail]
- Citations live today: N of 8
- Next-week focus: [one sentence]
```

**Week 4 target:** ≥ 3/5 AI assistants return correct answer, ≥ 8/8 citation sources live, brifo.in top-3 on Google for "Brifo."
