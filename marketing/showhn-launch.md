# Show HN Launch — Day 7 (Sunday)

**Objective:** Reach US dev & startup audience. A front-page Show HN can drive 500–3000 visitors and 50–200 signups. Top 10 spot is a multi-week tailwind for SEO & credibility.

**Important:** Only post if the product is polished enough to survive HN's scrutiny. HN front-pagers get 500+ eyeballs from deeply technical users in the first hour. If `brifo.in` has broken links, a flaky download, or an unpolished demo, **delay one week**. HN doesn't reward "shipping fast" — it rewards "shipping right."

---

## Posting mechanics

**When to post:** Sunday 6:30 AM IST = **Saturday 5 PM PT / 8 PM ET US**

Why that window:
- HN has its lowest submission volume on weekend evenings US time
- New submissions have the best chance to hit the front page when the queue is less crowded
- Show HN tag gives you a dedicated track with slightly more forgiving ranking

**Who posts:** Founder's personal HN account with **at least 3+ karma** (post will be shadowed if account is brand-new). If you don't have karma:
- This week: comment thoughtfully on 5–10 front-page threads daily. You'll earn 20+ karma easily.
- Never upvote your own post — HN flags it.

**Where to post:** https://news.ycombinator.com/submit → title starts with `Show HN:`

---

## Title (this is 80% of the outcome)

**Recommended:**
> **Show HN: Brifo – macOS meeting notes with no bot joining your call**

Why this title:
- "No bot joining" is the technical wedge HN will debate (privacy + local processing)
- "macOS" filters for the right audience
- Short, factual, no emoji, no hype

**Avoid:**
- "Introducing…" (killed by HN culture)
- "The future of…" (killed by HN culture)
- Any exclamation point
- Words: "revolutionary", "game-changing", "AI-powered" (all signal marketing, which HN distrusts)

---

## URL field

Submit with `https://brifo.in` — **NOT** the Google Form.

HN reads the URL as the "thing being shown." If you submit a form, the post looks like lead-gen and gets flagged. The beta signup link goes in the first comment.

---

## First comment (post immediately after submission)

**This is critical.** HN algorithm weights posts with author comments in the first 5 minutes. Post this as your own reply to your own submission the moment it goes live:

```
Hey HN — author here.

I'll be around today to answer anything. Some context on why we built this and a few technical notes that might be interesting:

**The wedge:** every meeting AI we tried joined the call as a bot. Fireflies, Otter, Fathom — all of them. That's fine for a solo user, but the moment you have a guest on the call (a prospect, a candidate, a vendor), the bot changes how people talk. We found ourselves turning the notetaker off for "important" calls — which is exactly when you need notes most.

So Brifo runs on your Mac, not in the meeting. It detects when a conference app is focused + mic is active + you have a calendar event matching — and starts capturing local audio. Your guests see nothing.

**A few technical details for HN:**

- Audio capture uses Core Audio Taps (macOS 14.4+). We previously tried screen-capture-based approaches — rejected because they tripped privacy indicators on every call, creating trust friction.
- Transcription is Deepgram with `interim_results=true` (we hit a silent failure last month on a config mismatch; interim_results is required if you set utterance_end_ms).
- The AI note pipeline is built on Mastra with a deterministic heuristic fallback — if OpenAI is down or rate-limited, you still get structured notes, just less nuanced ones.
- Meeting detection is event-based (IPC signals from our preload bridge), not polling. We poll every 2s only as a sanity check and require 5s of stable signal before confirming, to avoid false-positives on regular calls.

**What we haven't solved yet:**
- Speaker diarisation is rough when audio is muddy. We don't have per-participant audio streams (since we're not in the call), so diarisation quality depends on mic separation. Honest trade-off for the "no bot" design.
- No Windows / Linux version. We picked macOS because our ICP is already there, and Core Audio Taps gave us a clean capture API.

Code stack: Electron + React 19 + Zustand on the desktop, NestJS + MongoDB on the backend.

If you want to try it:
- Download (free during beta): https://brifo.in
- Cohort beta signup (we do manual onboarding): [FORM LINK]

Happy to go deep on any of this. And if you think the "no bot" positioning is a mistake, I especially want to hear that.
```

---

## Comment-defense playbook

HN will challenge you. Prepare responses for these likely pushes:

### "Why not just use OBS / ffmpeg + whisper.cpp yourself?"
```
Totally valid for single users. The value Brifo adds over a script:
1. Meeting detection (auto-start/stop, works across apps)
2. Pipeline: capture → transcription → summarisation → Jira ticket draft, with a reviewable queue
3. Multi-device sync, meeting search, chat Q&A over transcripts

If you're fine manually running ffmpeg and copy-pasting into Jira, Brifo probably isn't for you. We're built for people who lose a full workday a week to meeting admin.
```

### "This is just Granola / Fathom / Fireflies with different marketing"
```
The functional overlap is real. The architectural difference isn't marketing — it's a different design constraint. Granola uses a Chrome extension that attaches to the browser's conference tab (works, but only for browser-based calls). Fathom/Fireflies join as bots via the meeting platform's guest API.

Brifo doesn't do either. It captures at the OS audio layer. That's why it works on Zoom desktop, Slack Huddles, and Discord — all of which are hostile to the extension/bot patterns. The trade-off is weaker diarisation.

Different trade-off, same category. Some teams will prefer Brifo; some will prefer Granola. I'd rather lose to a fair comparison than win by being the only option.
```

### "What about Windows / Linux support?"
```
On the roadmap, not this quarter. macOS Core Audio Taps gave us a clean capture API that we couldn't easily replicate on Windows without WASAPI loopback quirks. We decided to ship one platform well before expanding. Genuinely sorry if you're on Windows.
```

### "Privacy — where does the audio go?"
```
Audio stays on-device for the raw capture. Transcription is sent to Deepgram (so the audio does leave your machine at that step). Note generation runs through OpenAI.

If you need truly local-only (no cloud for transcription either), we're not there yet. We're evaluating whisper.cpp for a "local-only mode" but the quality gap on Indian English + mixed-language meetings was too large last time we tested (January 2026).

For teams with compliance requirements, we're happy to discuss on-prem deployment of the transcription layer.
```

### "Why would I trust a 2-person startup with my meeting audio?"
```
Fair. Three things:
1. You can self-host the transcription + LLM layer (on-prem mode, for enterprise)
2. All data is scoped per-user; we have no multi-tenant data mixing
3. We're happy to sign a DPA for any team using it commercially

And honestly — at this stage, your bigger question is probably "will this company still exist in a year." That's a real risk. I'd rather be direct about it than pretend otherwise.
```

---

## What NOT to do

- ❌ Don't post a rehearsed PR-style launch blurb. HN smells it instantly.
- ❌ Don't ask friends to upvote. HN actively detects and penalises voting rings.
- ❌ Don't respond defensively to criticism. Every snarky reply costs you 10x the ranking you'd gain from a substantive one.
- ❌ Don't post if `brifo.in` is slow or broken on desktop. Test 10 minutes before posting.
- ❌ Don't launch if you can't stay on your laptop for 6 hours afterwards. A dead thread = dead launch.

---

## What to measure

Track these in real-time during launch day:

1. **Rank:** Check https://news.ycombinator.com every 15 min for first 3 hours. Screenshot when peak rank is hit.
2. **Points:** Aim for 20+ in the first hour. 50+ in the first 4 hours = front page likely.
3. **Comments:** Every comment is a signal. Good comments = good launch. 5+ deep technical comments = excellent launch.
4. **Traffic:** Add `?utm_source=hackernews&utm_medium=show&utm_campaign=launch7` to the form link in your first comment. Track signups.
5. **Downloads:** Google Analytics or a server log count of DMG downloads from https://brifo.in that day.

---

## Post-launch next-day actions

Monday morning:
- Write a "post-mortem" thread on X + LinkedIn with actual numbers (rank achieved, signups, top feedback theme). Build-in-public compounds — this single post usually outperforms the launch itself on LinkedIn.
- Reply to any late HN comments — HN posts stay active for 72 hrs
- Add one line to your HN profile linking to this thread (HN doesn't let you edit posts, but profile counts for recurring visitors)

---

## Honest probability assessment

Based on similar Show HN launches for meeting tools in the last 12 months:

| Outcome | Probability | What it looks like |
|--|--|--|
| Front page (top 30) | ~15% | 500–3000 visitors, 50–200 signups |
| Page 2 (top 30–90) | ~25% | 100–500 visitors, 10–40 signups |
| Not ranked, active comments | ~40% | 30–150 visitors, 3–15 signups |
| Quiet launch | ~20% | <30 visitors, 0–5 signups |

**Expected value:** ~20–40 signups from HN alone. The upside (front page) is the real prize — and it's as much luck as skill on any given weekend.

**If quiet launch happens:** don't re-post. HN flags duplicates. Wait 3+ months, ship a substantial update, and post again with a fresh angle.
