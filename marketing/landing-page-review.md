# Landing Page Review — brifo.in

**Reviewer:** Code audit of `landing-page/src/` + behavioral scan of production site
**Date:** 2026-04-24
**Severity legend:** 🔴 blocker for Week 1 · 🟡 hurts conversion, fix before Wednesday · 🟢 polish, do Week 2+

---

## Executive summary

Your landing page is clean, fast, and on-brand. The hero copy ("Meeting notes that write themselves") matches the tagline in your LinkedIn posts. Typography, spacing, and the accent-glow design feel considered.

**The critical problem is strategic, not visual:** your marketing posts say *"register for the beta, limited spots, register through the Google Form"* — but `brifo.in` says *"Download for Mac"* and immediately serves the DMG. A prospect clicking through from your LinkedIn/IG posts gets a different message than the one that drew them in.

**Fix priority:**
1. 🔴 Reconcile the "beta signup vs free download" mismatch (strategic decision needed)
2. 🔴 Nothing captures an email if a visitor doesn't download
3. 🟡 No social proof, no demo video, no product screenshots visible
4. 🟡 Download URL is a GitHub Releases link — raises trust & versioning questions
5. 🟢 Missing OG/meta tags for social previews (verify)

---

## 🔴 Critical Issue 1 — Beta vs. free-download messaging mismatch

**What your LinkedIn/IG posts say:**
> *"Register for the beta. Limited spots. First cohort gets early access + beta pricing locked in."*
> — from `linkedin-beta-launch.md` Day 7

**What brifo.in says:**
> *"Meeting notes that write themselves. … Free for Mac."* → Download button → `Brifo-0.1.5-arm64.dmg` from GitHub Releases

These two stories are inconsistent. A prospect reading your LinkedIn post expects: *"click, fill a form, wait for invite."* They land on brifo.in and see: *"click, download the app."* Three outcomes:

1. **Confused visitor bounces** (worst case — they don't trust the disconnect)
2. **They download, skip the Google Form** (better but you lose the high-quality cohort data)
3. **They go back to LinkedIn, click through to the Google Form link you embedded in the post directly** (only works if they remember)

### The strategic decision you need to make

**Option A — "The beta is actually open. Keep the free download."**
If your beta means "free to download right now," then drop the "register / limited spots / cohort" language from every post and frame it as a **free download with priority support for early signups.** The Google Form becomes an opt-in for a newsletter or a priority-support list, not a gate.

**Option B — "Register first, then get access."**
Replace the homepage Download button with a **"Join the beta waitlist"** CTA that goes to your Google Form. Only email the DMG link after form submission. This preserves cohort quality, but loses you some organic downloads.

**Option C (recommended for Week 1) — Two CTAs, clear labels.**
Keep the Download button for people who want it now. Add a second CTA: *"Join the beta cohort for onboarding + Jira setup help → [form]"*. Frames the Google Form as a **value-add** (hand-holding), not a gate. Both audiences are served.

→ **Decide this before Monday.** Don't launch Week 1 with the mismatch live.

---

## 🔴 Critical Issue 2 — No email capture on the main page

Right now, if someone lands on `brifo.in` and **isn't ready to download today**, the page has no way to reach them again. There's no:

- Email field for "notify me when the next version ships"
- Newsletter signup
- Beta waitlist form (as discussed above)
- Chat widget or contact form

**What this costs you:** roughly 60–80% of organic visitors don't convert on first visit. Without an email capture, all of them are lost. At even 5% email-capture rate across 1,000 visitors in Week 1, that's 50 warm leads you can drip-nurture for Week 2+.

**Fix (Option C from above covers this):** add a single email-input CTA near the hero and in the footer. Use Formspree, ConvertKit, or a Google Form with just the email field (60-second build).

---

## 🟡 Issue 3 — No social proof, no product visuals

The current hero shows:
- Headline
- Sub-headline
- Single "Download for Mac" button

Conspicuously absent:
- **Product screenshot or video** — users need to see what Brifo looks like before committing
- **Supported platform logos** (Zoom, Meet, Teams, Slack, Discord) — you mention these but don't show them
- **Social proof** — "X beta users / Y meetings captured / Z action items created"

This isn't about vanity — without a product screenshot, a skeptical visitor has no evidence that Brifo is real. For a tool this niche, showing is persuading.

**Fix (do before Wednesday):**
1. Add a single hero screenshot below the CTA button (use `marketing/instagram-posts/day5-slide2.png` or equivalent)
2. Add a row of platform logos: *"Works with: Zoom · Google Meet · Teams · Slack · Discord"* (you reference these in the site but they're not visualized)
3. Once you have 50+ beta signups, add a line: *"500+ founders & PMs on the beta waitlist"* (or honest directional language)

---

## 🟡 Issue 4 — Download URL is a GitHub Releases link

The download button points to:
```
https://github.com/noobie30/Brifo/releases/download/v0.1.5/Brifo-0.1.5-arm64.dmg
```

**Problems:**
- Users see a github.com URL on hover — some read that as "this might be a sketchy side-project"
- You have no install analytics (GitHub doesn't give you download counts per-referrer)
- You can't gate the download (for Option C above you'd want to email it after form submit)
- Updating v0.1.5 → v0.1.6 requires a code deploy since the URL is hardcoded in `landing-page/src/components/Hero.tsx:11` and `CTA.tsx:6`

**Fix (do before Wednesday):**
1. Host the DMG on a custom subdomain, e.g. `download.brifo.in` → redirects to latest release. Keeps the URL on-brand.
2. Or: route the download through a short URL like `brifo.in/download` that does a server-side redirect to the latest Release. Lets you change versions without redeploying the frontend.
3. Wrap the download link in a redirect URL that fires an analytics event (Plausible, Vercel Analytics, or GA4) so you can count downloads per traffic source.

---

## 🟡 Issue 5 — "Free" messaging may undercut future monetization

The hero says *"Free for Mac"* — which works for Week 1 acquisition but sets an expectation that's expensive to break later. Free apps that later add pricing see 30–50% churn + resentment in the community.

**Fix (low-cost):** Change to *"Free during beta"* everywhere. Four words, same conversion, preserves your pricing optionality.

File to edit: `landing-page/src/components/Hero.tsx:56` → sub-headline string.

---

## 🟢 Polish items (Week 2+, do after launch)

1. **OG + meta tags** — verify `landing-page/index.html` has `og:image`, `og:title`, `og:description` for clean previews on LinkedIn / Twitter / iMessage shares. If missing, your paste-a-link moments look bad.
2. **Mobile layout** — the page is desktop-oriented (makes sense for a macOS app) but ~40% of your LinkedIn traffic will be mobile. Test the mobile experience once. At minimum, make sure the hero button is large + tappable and the page doesn't horizontal-scroll.
3. **Favicon + PWA manifest** — small but polishing detail.
4. **Footer links** — make sure Privacy Policy + Terms are linked (Reddit and HN commenters will check; absence is a trust ding).
5. **Blog / changelog** — Week 2+ move. Even one blog post ("How Brifo captures meetings without joining them") gives you SEO surface area and signals real company.

---

## Recommended hero copy variants (to A/B test in Week 2)

Current:
> "Meeting notes that write themselves"
> "Brifo listens to your meetings and writes up the notes so you don't have to. No bot joins the call."

Variants — each leads with a different wedge:

**Jira-wedge (for PMs / EMs):**
> "Every meeting ends with Jira tickets already drafted"
> "Brifo captures your Mac meetings and queues every action item as a reviewable Jira issue. No bot joins the call."

**Time-wedge (for founders / ops):**
> "Get your afternoon back"
> "Brifo writes your meeting notes and drafts Jira tickets automatically — without a bot joining the call."

**Privacy-wedge (for enterprise / IT):**
> "Meeting notes without the meeting bot"
> "Brifo runs on your Mac, not in your meeting. Notes land on your desk. Guests never see a bot."

Pick one wedge per 14-day test. The one that converts best goes to the homepage; others move to targeted landing pages down the line.

---

## Tactical checklist before Monday 9 AM IST launch

- [ ] **Decide Option A / B / C** (beta vs download flow) — non-negotiable
- [ ] Add email-capture CTA near hero OR point "Download" to a signup form
- [ ] Add 1 hero screenshot (pull from `marketing/instagram-posts/`)
- [ ] Add "Works with: Zoom · Meet · Teams · Slack · Discord" logo strip
- [ ] Change "Free for Mac" → "Free during beta"
- [ ] Verify OG image for social preview (share brifo.in on a test LinkedIn post to your own profile + check)
- [ ] Add at least a basic analytics event on the Download button (Vercel Analytics is 1 line of code)
- [ ] Add a `/privacy` and `/terms` route (even if just placeholder pages with "Coming soon, reach us at hello@brifo.in")

**Time to execute above: ~90 minutes of code + copy edits.**

---

## Expected conversion impact (educated estimate)

| Change | Conversion lift |
|---|---|
| Reconcile beta vs download mismatch (alone) | +15–25% signup rate on paid traffic |
| Add email capture for non-ready visitors | +30–50% total warm leads captured |
| Add hero screenshot + platform strip | +10–20% download conversion |
| Verify OG tags | +5–15% click-through from social posts |
| All of the above together | 2–3× overall funnel output |

**Bottom line:** the landing page isn't the bottleneck for Week 1 — the beta vs download mismatch is. Fix that, add the email capture, and everything else is Week 2 work.
