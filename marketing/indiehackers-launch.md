# IndieHackers Launch — Day 6 (Saturday)

**Objective:** Drive 30–60 beta signups from a high-quality IH launch post. This is the single biggest organic lever of Week 1 for this ICP.

**Post in:** Main feed (not a group) — IH homepage algorithm surfaces high-engagement posts to all members
**Post time:** Saturday 8:00 AM IST / 10:30 PM PT Friday night. US IH is most active Friday night + Saturday morning US time.
**Author:** Post from the **founder's personal IH account** (not the brand). IH is explicitly a founder community — brand-account posts get auto-downranked. If there's no personal account yet, create one **Thursday** and comment/upvote 5–10 non-promo posts before Saturday.

---

## Title options (pick one — strong title drives 70% of upvotes)

**Recommended:**
> **Brifo — AI meeting notes that never join your call (macOS, no bot)**

Alternatives:
- *"We built an AI notetaker that stays out of the meeting entirely"*
- *"Show IH: Brifo — meeting notes for Mac, no bot in your waiting room"*
- *"After 12 meetings/week of manual notes, we built this"*

---

## Post body (copy-paste ready — replace `[LINK]` placeholders)

```
Hey IH 👋

Posting our first launch here. Looking for honest feedback more than upvotes.

**What it is:** Brifo — a macOS app that writes your meeting notes and drafts Jira tickets from every action item.

**What's different:** It doesn't join the call as a bot. It runs on your Mac, watches for the signals that a meeting is live (Zoom / Meet / Teams / Slack / Discord), and captures locally. Your guests never see "Brifo is in the waiting room."

---

**The actual story**

Last year our team logged where every working hour went. The meetings weren't the surprise. The 12 hours a week of *after-meeting* work was — typing up decisions, copying action items into Jira, chasing people for context that someone else thought they'd captured.

We tried every AI notetaker. The pattern was the same across all of them:

1. A bot in the waiting room, changing how people spoke
2. IT teams blocking the bot's domain
3. Nothing that meaningfully closed the loop into Jira (most stop at a link in an email)

So we built what we needed. A few design decisions if you're building something similar:

— **Audio capture is local.** No stream leaves your device before transcription.
— **Meeting detection is event-based, not polling.** The app listens for system-level signals (microphone active + calendar match + conference app focus) to avoid false positives on regular calls with your mom.
— **Jira push is dry-run first.** Every auto-drafted ticket goes into a review queue. One tap to approve. We built this after our own beta tester pushed 40 duplicate tickets from a single meeting on v0.1.

---

**What we're asking for**

1. **Feedback on the positioning.** "No bot in the call" is our wedge. Does that land, or is it too niche?
2. **Try the beta.** macOS only right now, free. 60-second form: [FORM LINK]
3. **What else should we integrate after Jira?** Linear is the obvious next one; we're also looking at Asana + ClickUp.

We're two people, Bengaluru-based, bootstrapped so far. Happy to answer anything.

Tech stack if anyone's curious: Electron + React for the desktop app, NestJS + Mongo on the backend, OpenAI + Mastra for the note generation pipeline (with a deterministic fallback so the app doesn't break if OpenAI is down).

Website: https://brifo.in
Beta signup: [FORM LINK]

Cheers,
[Founder name]
```

---

## Critical rules for IH launches

1. **Respond to every comment within 30 minutes of the post going live.** IH ranks posts by comment velocity. Staying on your laptop for the first 4 hours is worth more than any copy tweak.
2. **Never argue with negative feedback.** Thank the commenter, ask a follow-up, log the insight. Dismissive replies get downvoted into oblivion on IH.
3. **Don't flood with replies.** If you reply to every positive comment with "thanks!", it signals inauthenticity. Reply substantively (1-2 sentences minimum).
4. **Don't ask for upvotes.** IH has a strict anti-vote-begging culture. Focus the post on feedback, and upvotes follow.
5. **Post a follow-up 3–5 days later** with results ("Here's what happened after our IH launch — [N] signups, [biggest lesson]"). This gives you a second post on the same launch for free reach.

---

## First-hour engagement playbook

**t+0 min:** Post goes live. Pin the post to your IH profile. Cross-post the link to X/Twitter (see `twitter-beta-launch.md` Day 6).

**t+15 min:** DM 5 friendly founders the IH link. Ask for genuine feedback (not upvotes). These are people who'll leave substantive comments, which drives the IH algorithm.

**t+30 min:** First comments start arriving. Reply to every single one within 30 min, with substance.

**t+2 hrs:** Check the IH homepage — is the post visible? If not on page 1 by t+4 hrs, it's unlikely to break out. That's OK — the signups from the first 100 viewers are still real.

**t+24 hrs:** Post the X/Twitter update amplification thread (see Day 6 X plan).

---

## What "good" looks like on IH

- **Homepage front page for 12+ hrs:** 100–500 signups possible
- **Front page for 6 hrs:** 30–60 signups typical
- **Not on front page but active comments:** 10–25 signups
- **No front page, 2–3 comments:** 3–10 signups

Don't let the bottom outcome tank morale — even "no front page" IH posts reliably produce 5–15 qualified founder signups, which is a higher-converting cohort than any other channel.

---

## Attribution

Use this exact URL in the post:
```
[GOOGLE FORM LINK]?utm_source=indiehackers&utm_medium=post&utm_campaign=launch7&utm_content=day6
```

In your tracking sheet, every signup with this UTM string = IH-attributed.
