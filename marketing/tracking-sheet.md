# Week 1 Tracking Sheet — Brifo Beta Launch

Import this into Google Sheets (File → Import → paste markdown) or copy each section into tabs. All UTM values are what I used in the channel-specific docs — keep them consistent or your attribution breaks.

---

## Tab 1: Post Log

Log every post the moment it goes live. Reach/likes/comments/signups get filled in end-of-day.

| Date | Day | Channel | Post URL | Format | Topic | Reach | Likes | Comments | Link clicks | Signups (UTM) |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-04-27 | Mon | LinkedIn | | Text+img | Launch announcement | | | | | |
| 2026-04-27 | Mon | Instagram | | Carousel | Launch teaser | | | | | |
| 2026-04-27 | Mon | X | | Tweet+thread | Launch | | | | | |
| 2026-04-28 | Tue | LinkedIn | | Text | Admin tax | | | | | |
| 2026-04-28 | Tue | Instagram | | Carousel | Meeting tax | | | | | |
| 2026-04-28 | Tue | X | | Tweet | Admin tax | | | | | |
| 2026-04-28 | Tue | Reddit | | Post | r/macapps launch | | | | | |
| 2026-04-29 | Wed | LinkedIn | | Text+video | No-bot feature | | | | | |
| 2026-04-29 | Wed | Instagram | | Reel | No-bot feature | | | | | |
| 2026-04-29 | Wed | X | | Thread | No-bot (5-tweet) | | | | | |
| 2026-04-29 | Wed | Reddit | | Discussion | r/ProductMgmt | | | | | |
| 2026-04-30 | Thu | LinkedIn | | Carousel | Jira push | | | | | |
| 2026-04-30 | Thu | Instagram | | Reel | Jira push | | | | | |
| 2026-04-30 | Thu | X | | Tweet+imgs | Jira push | | | | | |
| 2026-05-01 | Fri | LinkedIn | | Text | Day-in-life | | | | | |
| 2026-05-01 | Fri | Instagram | | Carousel | Day-in-life | | | | | |
| 2026-05-01 | Fri | X | | Tweet | Friday meme | | | | | |
| 2026-05-02 | Sat | IndieHackers | | Main post | Launch | | | | | |
| 2026-05-02 | Sat | LinkedIn | | Text | IH update | | | | | |
| 2026-05-02 | Sat | Instagram | | Photo | Behind-the-build | | | | | |
| 2026-05-02 | Sat | X | | Tweet | IH amplify | | | | | |
| 2026-05-02 | Sat | Reddit | | Comment | r/SaaS thread | | | | | |
| 2026-05-03 | Sun | Hacker News | | Show HN | Launch | | | | | |
| 2026-05-03 | Sun | LinkedIn | | Text | Week recap | | | | | |
| 2026-05-03 | Sun | Instagram | | Carousel | Week recap | | | | | |
| 2026-05-03 | Sun | X | | Thread | Recap numbers | | | | | |

> **Start date placeholder:** rows use Mon 2026-04-27. If you launch a different week, do a find-and-replace on dates before importing.

---

## Tab 2: UTM Reference (copy-paste into Sheets as a lookup)

These are the exact strings I used in every post. Use them unchanged so attribution matches.

| Channel | UTM source | UTM medium | UTM campaign | Example UTM content |
|---|---|---|---|---|
| LinkedIn | `linkedin` | `post` | `launch7` | `day1`, `day2`, … `day7` |
| Instagram | `instagram` | `post` or `bio` | `launch7` | `day1`–`day7` |
| X / Twitter | `twitter` | `post` or `thread` | `launch7` | `day1`–`day7` |
| IndieHackers | `indiehackers` | `post` | `launch7` | `day6` |
| Hacker News | `hackernews` | `show` | `launch7` | `day7` |
| Reddit r/macapps | `reddit` | `macapps` | `launch7` | `day2` |
| Reddit r/ProductManagement | `reddit` | `productmgmt` | `launch7` | `day3` |
| Reddit r/SaaS | `reddit` | `saas` | `launch7` | `day6` |
| Reddit r/IndianStartups | `reddit` | `indianstartups` | `launch7` | — |
| WhatsApp / DMs | `dm` | `whatsapp` or `linkedin-dm` | `launch7` | `day-n` |

**Example full URL:**
```
https://forms.gle/yourForm?utm_source=linkedin&utm_medium=post&utm_campaign=launch7&utm_content=day3
```

---

## Tab 3: Daily Summary (dashboard view)

Fill at end of each day (5 min).

| Date | Day | Total signups (day) | Cumulative | Best post | Best channel | Biggest surprise | Action for tomorrow |
|---|---|---|---|---|---|---|---|
| 2026-04-27 | Mon |  |  |  |  |  |  |
| 2026-04-28 | Tue |  |  |  |  |  |  |
| 2026-04-29 | Wed |  |  |  |  |  |  |
| 2026-04-30 | Thu |  |  |  |  |  |  |
| 2026-05-01 | Fri |  |  |  |  |  |  |
| 2026-05-02 | Sat |  |  |  |  |  |  |
| 2026-05-03 | Sun |  |  |  |  |  |  |

---

## Tab 4: Signup Quality Scorecard

Every time someone signs up, log these from the Google Form response. This is how you'll pick the first invite cohort.

| Email | Name | Role | Team size | Meetings/wk | Uses Jira? | Company | UTM source | UTM campaign | Priority (P1/P2/P3) | Invited? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |

**Priority rubric:**
- **P1 (invite Day 1):** Uses Jira daily + 16+ meetings/week + team size 11+ + role = PM / EM / Founder
- **P2 (invite Day 3–5):** 2 of the above 4 criteria
- **P3 (waitlist):** Anything else — thank them, tell them the order of invite

---

## Tab 5: Engagement Log (DMs + comments + conversations)

Track relationship-building separately from posts. These convert at 10–20% vs. <1% for posts.

| Date | Person | Platform | What you sent | Their reply | Outcome |
|---|---|---|---|---|---|
|  |  |  |  |  | Signed up / Declined / Scheduled call / No reply |

Aim: 5 DMs/day to warm contacts, tracked here. These are your highest-ROI moves.

---

## Tab 6: Competitor monitor (for reply / quote-tweet moves)

Save this as a daily 5-min check.

| Date | Competitor | Tweet/post URL | Why it's relevant | My reply link | Result |
|---|---|---|---|---|---|

Keywords to scan daily:
- "Granola" — especially complaints
- "Fireflies" OR "Fathom" OR "Otter" — privacy concerns, bot issues
- "meeting bot" — anyone venting
- Search X + LinkedIn + Reddit for these daily

---

## Week 1 Success Criteria (set these before you launch)

| Metric | Target | Stretch | Red flag |
|---|---|---|---|
| Total beta signups | 50 | 100 | <15 |
| LinkedIn followers (company) | 40 | 100 | <10 |
| Instagram followers | 50 | 150 | <20 |
| X followers | 25 | 75 | <10 |
| IH post upvotes | 30 | 80 | <10 |
| HN points peak | 20 | 80+ (front page) | <10 |
| Reddit post engagement | 10+ comments | 30+ | Removed by mods |

**If you hit red flag on any metric:** see "Root cause table" below.

---

## Root cause table — what to check if numbers are low

| Symptom | Most likely cause | Fix |
|---|---|---|
| <15 signups by end of week | Signup page friction OR positioning unclear | Screenshot-record your own signup flow; if it takes >60s, shorten. Otherwise test a different wedge (privacy vs Jira vs friction) next week. |
| Good reach, few clicks | CTA buried or weak | Move CTA to line 2 of post, make it one-click obvious. |
| Good clicks, few signups | Form abandonment | Check Google Form "responses vs views" in Form Insights. If 50%+ drop-off, remove optional fields. |
| Low reach on LinkedIn | Algorithm penalty for external links | Move link to first comment, not the post body. Check again in 48 hrs. |
| Posts removed on Reddit | Self-promo rules violated | Re-read sidebar, use pinned threads only next time. |
| HN quiet launch | Timing / title / account karma | See `showhn-launch.md` probability table — don't re-post. |

---

## End-of-week review (30 min, Sunday evening)

Write the answers in a fresh doc or at the bottom of this sheet:

1. **What one post drove the most signups?** Double down on that format/topic in Week 2.
2. **What one channel drove the most signups per minute invested?** Double down, quietly drop the worst-performing one.
3. **What did people say in comments/DMs you didn't expect?** This is your positioning insight.
4. **What's the one thing to change in Week 2?** Pick one variable; don't change everything.
5. **What did NOT work and should stop?** Be ruthless — energy on the wrong thing is the biggest cost this early.
