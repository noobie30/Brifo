# Brifo — AI Meeting Notes Without Bots

> Free macOS app that auto-captures meetings and generates AI-powered notes, action items, and follow-up emails — no bot joins the call.

**Website:** <https://brifo.in>
**Download:** <https://brifo.in> (Download for Mac)
**API:** <https://api.brifo.in>
**API docs:** <https://api.brifo.in/api/docs>

---

## What Brifo does

Brifo is a native macOS desktop app that:

1. **Auto-detects meetings** on your Mac (polls every 2s, confirms after 5s of stability)
2. **Captures system audio locally** — no bot joins the call, no browser extension needed
3. **Transcribes and generates structured AI notes** — summary, decisions, action items, follow-up emails
4. **Syncs with your calendar** and pushes action items to Jira

Works with Zoom, Google Meet, Microsoft Teams, Slack Huddles, Discord, and anything that plays audio through the system.

## Key features

- **Auto-detection** — the app notices a meeting is in progress and starts capturing on its own
- **AI-powered notes** — structured summaries with key decisions, action items, and suggested follow-ups
- **No bot required** — captures system audio locally; your meeting participants see nothing unusual
- **Jira integration** — action items become Jira tickets in one click
- **Google Calendar sync** — matches captures to scheduled events
- **Meeting chat** — ask questions about any past meeting and get AI-powered answers
- **Privacy-first** — audio is processed locally and never stored; only transcripts are sent to the cloud

## Pricing

Brifo is **free** on macOS (Apple Silicon).

## FAQ

### What is Brifo?

Brifo is a free macOS desktop app that automatically captures your meetings and generates AI-powered notes, action items, and follow-up emails — without a bot joining the call.

### Does Brifo add a bot to my meeting?

No. Brifo captures system audio locally on your Mac. No bot or browser extension is needed. It works with Zoom, Google Meet, Teams, and any other meeting platform.

### Is Brifo free?

Yes. Brifo is free to download and use on macOS.

### What platforms does Brifo work with?

Brifo works with any meeting platform that uses system audio — Zoom, Google Meet, Microsoft Teams, Slack Huddles, Discord, and more.

### Where is my audio stored?

Audio is processed locally on your Mac and is never uploaded or stored. Only the resulting transcript is sent to Brifo's cloud backend for AI processing.

## Technical details

- **Platform:** macOS (Apple Silicon)
- **Architecture:** Electron desktop app + NestJS cloud backend
- **AI:** OpenAI GPT-4.1 for note generation and action item extraction
- **Database:** MongoDB
- **Integrations:** Google Calendar, Jira (OAuth)

## Agent discovery

- **API catalog:** <https://brifo.in/.well-known/api-catalog> (RFC 9727, `application/linkset+json`)
- **Agent skills index:** <https://brifo.in/.well-known/agent-skills/index.json>
- **OpenAPI spec:** <https://api.brifo.in/api/docs-json>
- **Swagger UI:** <https://api.brifo.in/api/docs>
- **OAuth protected-resource metadata:** <https://api.brifo.in/.well-known/oauth-protected-resource>
- **OAuth authorization-server metadata:** <https://api.brifo.in/.well-known/oauth-authorization-server>
- **llms.txt:** <https://brifo.in/llms.txt>

## Contact

Visit <https://brifo.in> to download Brifo or get in touch.
