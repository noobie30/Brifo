# Reddit Launch Plan — Week 1

**Objective:** Drive qualified beta signups from 3 target subreddits. Reddit is the highest-variance channel in your plan — one good post can deliver more signups than all of LinkedIn combined, but a bad post (or a good post in the wrong sub) gets removed in 10 minutes.

---

## The first rule: read the sidebar first

Every subreddit has a self-promotion rule. Violating it gets your post + account flagged. These subs auto-remove promotional posts in minutes, not hours. **Before posting anything, read that subreddit's rules page in full.**

Most self-promo rules fall in one of three buckets:
- **Strict ratio** (e.g., 10:1 — you need 10 non-promo comments/posts for every 1 promo post)
- **Designated days** (e.g., "Self-promo only on Saturdays")
- **Thread-based** (e.g., "Self-promo only in the weekly pinned thread")

---

## Account setup (this week)

Your Reddit account needs to look real before a launch post. Starting today:

1. **Use a personal Reddit account** (not a brand account named `brifoapp`). Brand accounts get auto-downranked on every post.
2. **Target 50+ karma before any launch post.** This isn't vanity — under ~10 karma, most subs auto-filter your submissions into mod queue where they die.
3. **Comment/upvote genuinely for 3 days before posting.** In each target subreddit, leave 3–5 substantive comments (not "this is great!") to signal you're a real member.
4. **Delete the LinkedIn signature in your Reddit profile.** Reddit is hostile to anything that looks like a marketing funnel.

---

## Target subreddits (in priority order)

### 1. r/macapps — **best fit for Brifo**
- **Subscribers:** ~180k (as of April 2026)
- **Rules:** App developers can post their own apps with `[Developer]` flair. Must be Mac-native. Needs to disclose you're the developer.
- **Best day to post:** Tuesday-Wednesday 9 AM PT (evening IST)
- **Post style:** Show the app honestly. Don't pitch. Screenshots are expected and welcomed.

### 2. r/ProductManagement — **second-best fit**
- **Subscribers:** ~350k
- **Rules:** Very strict on self-promo. Must check the pinned "Promote your product" thread or post during sanctioned windows. Read sidebar + pinned rules carefully.
- **Best day:** Tuesday-Thursday, mid-morning US time
- **Post style:** PM-focused angle. Lead with the Jira workflow, not the app. Problem-solution framing works.

### 3. r/SaaS — **third, most crowded**
- **Subscribers:** ~220k
- **Rules:** Self-promo allowed in pinned weekly thread only (typically "Share your startup / launch" weekly thread). Standalone promo posts get removed fast.
- **Best day:** Whatever day their weekly self-promo thread posts
- **Post style:** Founder-led, numbers-focused, honest about stage

### Optional / secondary targets

- **r/sideproject** — much more self-promo friendly, but lower conversion
- **r/IndianStartups** — India-first angle, small sub but high-quality engagement
- **r/startups** — big sub but very strict moderation
- **r/productivity** — consumer-heavy; good for top-of-funnel awareness, weak for beta conversion

---

## Post 1 — r/macapps (Day 2 Tuesday)

**Post as:** Self-text post with `[Developer]` flair
**Title:**
> I built a meeting notes app that doesn't join your call as a bot (macOS)

**Body:**
```
Hey r/macapps — been lurking here for years, finally have something to share.

I built Brifo because I was tired of Fireflies / Otter / Fathom bots sitting in the waiting room of every call. Good tools, but my guests would visibly slow down the moment they saw a bot appear. For customer calls and interviews, that's a real cost.

Brifo takes a different approach — it runs on your Mac and captures locally. No bot joins the meeting. It auto-detects when a call starts (across Zoom, Google Meet, Teams, Slack Huddles, Discord) and writes the notes + drafts Jira tickets the moment you hang up.

A few screenshots so you can see what it actually looks like:

[SCREENSHOT 1 — meeting detection banner]
[SCREENSHOT 2 — generated notes view]
[SCREENSHOT 3 — Jira ticket auto-draft queue]

**Tech notes for anyone curious:**
- Audio capture uses Core Audio Taps (needs macOS 14.4+)
- Local audio capture, Deepgram for transcription, OpenAI for note generation
- Meeting detection is event-based — mic + conf-app focus + calendar match

**Honest limitations:**
- Speaker diarisation is weaker than bot-based tools (no per-participant streams)
- macOS only right now
- Requires ~15MB RAM idle, ~200MB during an active capture

Free during beta if you want to try it. Direct download + beta signup at https://brifo.in.

Would genuinely love feedback — especially if you've tried Fathom / Fireflies / Granola and have a strong opinion on where they fall short.
```

**UTM on the beta signup link:**
`?utm_source=reddit&utm_medium=macapps&utm_campaign=launch7`

**Must-do:** Engage every comment in the first 2 hours. r/macapps rewards authentic developer engagement.

---

## Post 2 — r/ProductManagement (Day 3 Wednesday)

⚠️ **Do not post this as a standalone submission.** r/ProductManagement removes self-promo aggressively. Instead:

**Approach A (recommended):** Find the weekly pinned "Tools & Resources" or "Self-Promotion" thread and comment in it.

**Approach B:** Re-frame as a *discussion post* (not a promo). Title:
> PMs: how do you keep action items from dying in the gap between meeting end and Jira?

**Body (discussion-framed):**
```
Real question from someone building in this space: I'm curious how other PMs handle the action-item gap.

Meeting ends at 10:15. Four things got agreed on. By Monday, two are missing and nobody remembers who owned them. This seems universal, but solutions vary a lot:

- Some teams assign a scribe per meeting
- Some use meeting-recorder tools and manually copy action items to Jira after
- Some have started using AI notetakers (Fireflies, Fathom, Granola) — mixed feelings I've heard
- Some accept the loss

What's actually working for your team?

(Disclosure: I'm one of the folks building Brifo, a tool that auto-drafts Jira tickets from meetings. But I'm more interested in learning here than pitching — what does the status quo look like at your org?)
```

**Why this works:** Genuine question + honest disclosure. Mods allow this because it invites discussion. Signups come from profile visits, not from a direct link.

**If you want a direct-link post**, use the **weekly pinned self-promo thread** — it's the only safe channel.

---

## Post 3 — r/SaaS (Day 6 Saturday — piggyback on IH launch)

**Where to post:** The weekly "Share your SaaS" pinned thread (check for the current week's thread title and post as a top-level comment).

**Comment content:**
```
Launching Brifo this weekend.

**What:** macOS app that writes meeting notes + drafts Jira tickets. No bot joins the call.

**Stage:** Public beta this week. 2 founders, Bengaluru.

**What I'd love from you:** honest feedback on the positioning. Our wedge is "no bot in the call" — is that clear enough to make you try it, or too niche?

Website: https://brifo.in
Beta signup: [FORM LINK]
Also launched on IH today: [IH POST URL]

Happy to give feedback on your SaaS too — drop the link below.
```

**Why a comment in the pinned thread beats a standalone post:** r/SaaS actively removes standalone launch posts. The pinned thread is the legal channel, and it has decent viewership.

---

## Secondary target — r/IndianStartups (whenever)

This sub is smaller and quirky but friendly to founder-posted launches. Post anytime after Day 3 with a straightforward launch narrative.

**Title:**
> Launched our first macOS app this week — Brifo, meeting notes for Indian teams

**Body:**
```
Hi r/IndianStartups — sharing a launch from Bengaluru.

We shipped Brifo, a macOS meeting-notes app, earlier this week. Two of us, bootstrapped, first public beta.

The product: captures meetings across Zoom / Meet / Teams / Slack / Discord without a bot joining the call, writes a summary when you hang up, and drafts Jira tickets from every action item.

**Why I'm posting here specifically:** we built this in India and most of the existing meeting tools are US-priced and US-targeted. Granola is $19/month, Fathom is $24/month per user — fine for a US team, painful for an Indian team of 10. We're keeping the beta free and planning India-friendly pricing when we launch.

**What I'd love from this sub:**
1. Indian founders / PMs / team leads who want to try the beta
2. Feedback on pricing (how much would you pay? monthly vs annual?)
3. Other Indian SaaS tools you wish existed — we're in the market-mapping phase for v2

Website: https://brifo.in
Beta: [FORM LINK]

Cheers 🇮🇳
```

---

## Do-not-do list

| Don't | Why |
|---|---|
| Don't post the same content to multiple subs on the same day | Reddit flags cross-posting as spam |
| Don't edit your post with "EDIT: signups going well!" in the first hour | Looks salesy, kills comment engagement |
| Don't use a bot or karma-farm account | Reddit mods detect new accounts, posts get shadow-removed |
| Don't reply defensively to criticism | Reddit amplifies drama; one snarky reply can tank a good post |
| Don't share affiliate codes or "first 50 free" urgency | r/SaaS auto-removes anything that reads like spam |

---

## What "good" looks like per sub

| Subreddit | Good outcome (signups) | Typical outcome (signups) |
|---|---|---|
| r/macapps | 20–60 | 5–15 |
| r/ProductManagement | 15–40 (discussion post) | 2–8 |
| r/SaaS pinned thread | 5–15 | 1–5 |
| r/IndianStartups | 10–25 | 3–8 |

**Combined expectation (realistic):** 15–35 signups from Reddit in the week.
**Combined best case:** 50–100+ if r/macapps picks up.

---

## Weekly engagement hygiene

For each target sub, throughout the week (10 min/day):

1. Upvote 10–15 posts that are genuinely interesting to you (not strategically)
2. Leave 1–2 substantive comments per day (not on your own posts)
3. Avoid any mention of Brifo in unrelated threads — Reddit's immune system hates drive-by plugs

This gives you karma for future posts AND flags your account as a legitimate member, which matters in the mod queue.
