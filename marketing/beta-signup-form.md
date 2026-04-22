# Brifo Beta Signup — Google Form Spec

**Purpose:** Collect beta registrations from the 7-day Instagram/LinkedIn campaign, qualify signups so the first cohort is the right fit, and keep completion rates high.

---

## Form Setup (Google Forms → Create blank form)

**Form title:** `Brifo Beta — Register Your Interest`

**Form description (intro text shown above the first question):**
```
Thanks for your interest in the Brifo beta 👋

Brifo is a macOS app that auto-writes your meeting notes and pushes action items into Jira — without a bot joining the call.

This takes 60 seconds. We'll email invites to the first cohort next week.
```

**Settings to enable:**
- ✅ Collect email addresses (automatic)
- ✅ Limit to 1 response (prevents duplicates if they're signed in)
- ✅ Show progress bar
- ✅ Shuffle question order: **OFF** (order matters)
- ✅ Send respondents a copy of their response
- ✅ Response receipts: **On**

**After-submit message:**
```
You're on the list ✅

We'll email you from hello@brifo.in when your invite is ready. In the meantime, follow @brifo_app for launch updates.

— Team Brifo
```

---

## Questions (in order)

### Q1. Full name *(required, short answer)*
**Label:** `Your name`
**Description:** `So we know what to call you in the invite email.`
**Validation:** Text, not empty.

---

### Q2. Work email *(required, short answer)*
**Label:** `Work email`
**Description:** `We'll send your beta invite here. A work email helps us understand the team you're on.`
**Validation:** Response validation → Regular expression → Matches `^[^@\s]+@[^@\s]+\.[^@\s]+$` (basic email)
**Optional nudge:** Add a note — *"Personal emails are fine too, work emails get priority access."*

---

### Q3. Role *(required, multiple choice)*
**Label:** `What's your role?`
**Description:** `Pick the closest fit.`
**Options:**
- Product / Project Manager
- Engineer / Engineering Manager
- Founder / CEO / Operator
- Designer
- Sales / Customer Success
- Consultant / Agency
- Other (opens short answer)

Why multiple choice instead of free text: clean segmentation, lets you sort the first cohort by ICP.

---

### Q4. Company name *(required, short answer)*
**Label:** `Where do you work?`
**Description:** `Company or team name. "Solo / freelance" is a valid answer.`

Why: huge help for prioritisation — seeing a cluster of users from the same company tells you a team rollout is possible.

---

### Q5. Team size *(required, multiple choice)*
**Label:** `How big is your team?`
**Options:**
- Just me / solo
- 2–10
- 11–50
- 51–200
- 201–1,000
- 1,000+

Why: team size is the #1 predictor of whether Brifo's Jira-push workflow matters to someone.

---

### Q6. How many meetings a week? *(required, multiple choice)*
**Label:** `Roughly how many work meetings do you attend per week?`
**Options:**
- 0–5
- 6–15
- 16–25
- 26+

Why: direct proxy for how much value Brifo delivers. Prioritise 16+ for the first cohort.

---

### Q7. Do you use Jira? *(required, multiple choice)*
**Label:** `Do you (or your team) use Jira?`
**Options:**
- Yes, daily
- Yes, occasionally
- No, we use something else (Linear, Asana, ClickUp, etc.)
- No, we don't use a task tracker

Why: Jira is the #1 integration. Users who say "yes, daily" are the ones who should get invited Day 1. Users on Linear/Asana get queued for when you ship those integrations.

---

### Q8. Mobile number *(optional, short answer)*
**Label:** `Mobile number (optional)`
**Description:** `Only if you'd like a quick call when we onboard your cohort. We won't use it for marketing.`
**Validation:** Regular expression → `^[0-9+\-\s()]{7,20}$` — tolerant of formats.

**Recommendation:** Honour the "no marketing" promise. If you don't plan to call people, drop this field entirely.

---

### Q9. Gender *(optional, multiple choice)* — ⚠️ **see note below**
**Label:** `Gender (optional)`
**Options:**
- Woman
- Man
- Non-binary
- Prefer not to say
- Prefer to self-describe (opens short answer)

---

### Q10. Anything we should know? *(optional, long answer / paragraph)*
**Label:** `Anything you'd like us to know? (optional)`
**Description:** `What you're hoping Brifo will help with, what you've tried before, anything useful.`

Why: this is gold. 10% of people write a sentence or two, and those sentences tell you exactly how to write your onboarding emails and follow-up messaging.

---

### Q11. How did you hear about Brifo? *(optional, multiple choice)*
**Label:** `How did you hear about us?`
**Options:**
- Instagram
- LinkedIn
- Twitter / X
- A friend or colleague
- Google / search
- Product Hunt
- Other

Why: cheapest possible attribution. Tells you which of your 14 planned posts actually drove signups.

---

## Honest Feedback on Your Proposed Fields

### 🚩 On collecting **gender** in a B2B SaaS beta form

I'd recommend **dropping this field** unless you have a specific reason to keep it. Here's why:

1. **It's not actionable for Brifo.** For a B2B meeting-notes tool, gender doesn't inform who you invite first, how you price the product, or how you message it. If a field doesn't drive a decision, it's noise.
2. **It increases abandonment.** Every extra field shaves 2-5% off completion rate. Fields that feel irrelevant to the product ("why do they need to know this?") cause people to bounce.
3. **It can feel intrusive.** Some candidates — especially those with sensitivity around the topic — will quietly close the tab rather than answer.

**Keep it only if:**
- You're tracking diversity metrics for your cap table / investors
- You're running a targeted outreach (e.g., "women in tech" cohort)
- You have a specific D&I reporting requirement

If you want the data-privacy-friendly version anyway: make it optional (as I've done above) and place it near the end so someone who skips still submits the form.

### What I'd **add** instead (bigger payoff)

The seven fields below are what actually help you run a beta. In order of value:

| Field | Why it's worth the extra friction |
|-------|-----------------------------------|
| **Team size** | Predicts feature fit — solo vs team-of-50 are different users |
| **Meetings per week** | Predicts value delivery — someone with 25 meetings will love Brifo; someone with 3 won't |
| **Uses Jira?** | Your flagship integration — dictates first-cohort priority |
| **How did you hear about us?** | Attribution — tells you which post/channel works |
| **Anything else?** (open-ended) | Qualitative gold; shapes your onboarding copy |
| **Company name** | Spots team-level interest (5 signups from one company = call the IT lead) |
| **Role** | Segmentation — PMs vs engineers vs founders need slightly different onboarding |

### What I'd **drop** (or make clearly optional)

| Field | Why |
|-------|-----|
| **Gender** | No decision depends on it (see above) |
| **Mobile number** | Only collect if you'll actually call. Otherwise it's just a trust tax. |
| **Address / location / timezone** | Not needed for a macOS app. If you need timezone for scheduling, add it only when inviting them to onboarding, not at signup. |
| **Date of birth / age** | No decision depends on it; also GDPR risk. |
| **Current notetaker tool** | Tempting, but better asked in the onboarding survey after they're in |

---

## Recommended Final Field List (Copy-paste into Google Forms)

For maximum signups × maximum useful data:

1. Full name — **required**
2. Work email — **required**
3. Role — **required**, multi-choice
4. Company name — **required**
5. Team size — **required**, multi-choice
6. Meetings per week — **required**, multi-choice
7. Use Jira? — **required**, multi-choice
8. Anything we should know? — **optional**, paragraph
9. How did you hear about us? — **optional**, multi-choice

**Time to complete:** ~60 seconds. Expected completion rate: 85–92%.

If you keep mobile and gender:

10. Mobile — optional
11. Gender — optional (and placed last)

Expected completion rate drops to ~70–78%.

---

## Quick Setup Steps in Google Forms

1. Go to [forms.google.com](https://forms.google.com) → blank form
2. Title + description → paste from above
3. Add each question above with its type + required toggle
4. **Settings → Responses** → enable "Collect email addresses" + "Limit to 1 response"
5. **Settings → Presentation** → enable "Show progress bar"
6. **Settings → Presentation → Confirmation message** → paste the after-submit copy
7. **Send** button → copy the short `forms.gle/…` URL
8. Replace `[GOOGLE FORM LINK]` in both Instagram and LinkedIn plans
9. **Pro tip:** in the responses tab, click the green Sheets icon → link to a spreadsheet. Add a "Priority" column and start tagging cohort 1 / cohort 2 as signups come in.

---

## Post-Launch: Segmenting Your Cohort 1 Invites

Sort your spreadsheet by these rules — give Day 1 invites to people who match **3 or more**:

- Uses Jira daily ✅
- 16+ meetings per week ✅
- Team size 11+ ✅
- Role = PM, Engineering Manager, or Founder ✅
- Wrote something meaningful in the "anything else?" field ✅

That's your best-case ICP. Aim for 50-100 in the first invite batch — small enough to support, big enough to learn from.
