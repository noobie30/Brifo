// WebMCP bridge — exposes a handful of safe, read-only tools from the
// landing page to AI agents via navigator.modelContext.
//
// Spec: https://webmachinelearning.github.io/webmcp/
// Chrome EPP: https://developer.chrome.com/blog/webmcp-epp

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  description?: string;
  items?: JsonSchema;
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
};

type ModelContext = {
  provideContext: (context: { tools: WebMCPTool[] }) => Promise<void> | void;
};

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

const DOWNLOAD_URL =
  (import.meta.env.VITE_DOWNLOAD_URL as string | undefined) ?? "https://brifo.in";

const FAQ: Array<{ question: string; answer: string }> = [
  {
    question: "What is Brifo?",
    answer:
      "Brifo is a free macOS desktop app that automatically captures meetings and generates AI-powered notes, action items, and follow-up emails — without a bot joining the call.",
  },
  {
    question: "Does Brifo add a bot to my meeting?",
    answer:
      "No. Brifo captures system audio locally on your Mac. No bot, no browser extension. Works with Zoom, Google Meet, Microsoft Teams, and any app that plays through system audio.",
  },
  {
    question: "Is Brifo free?",
    answer: "Yes. Brifo is free to download and use on macOS.",
  },
  {
    question: "What platforms does Brifo work with?",
    answer:
      "Any meeting platform that plays through macOS system audio — Zoom, Google Meet, Microsoft Teams, Slack Huddles, Discord, Webex, and more.",
  },
  {
    question: "Where is my audio stored?",
    answer:
      "Audio is processed locally on your Mac and is never uploaded or stored. Only the resulting transcript is sent to Brifo's cloud backend for AI processing.",
  },
  {
    question: "What Mac versions are supported?",
    answer:
      "macOS 12 Monterey or later, on Apple Silicon (M1/M2/M3/M4). Intel Macs are not supported.",
  },
];

const SECTIONS = [
  "hero",
  "how-it-works",
  "integrations",
  "cta",
  "download",
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_ALIASES: Record<Section, string> = {
  hero: "hero",
  "how-it-works": "how-it-works",
  integrations: "integrations",
  cta: "cta",
  download: "cta",
};

const textResult = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
});

const tools: WebMCPTool[] = [
  {
    name: "get_brifo_overview",
    description:
      "Returns a concise overview of Brifo: what it does, supported platforms, pricing, and the core privacy behavior. Use when a user asks what Brifo is or what it can do.",
    inputSchema: { type: "object", properties: {} },
    execute: () =>
      textResult(
        [
          "Brifo is a free macOS desktop app that automatically captures meetings and generates AI-powered notes, action items, and follow-up emails.",
          "",
          "- Platform: macOS (Apple Silicon only — M1/M2/M3/M4)",
          "- Pricing: Free",
          "- Audio: captured locally; never uploaded. Only transcripts go to the cloud.",
          "- No bot joins the call; no browser extension.",
          "- Works with Zoom, Google Meet, Microsoft Teams, Slack Huddles, Discord, and any app using system audio.",
          "- Integrations: Google Calendar, Jira.",
          "",
          `Download: ${DOWNLOAD_URL}`,
        ].join("\n"),
      ),
  },
  {
    name: "get_brifo_faq",
    description:
      "Returns answers to common Brifo questions. Optionally filter by a topic keyword (e.g. 'bot', 'privacy', 'price', 'mac', 'teams').",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Optional keyword to filter FAQ entries (case-insensitive substring match on question and answer).",
        },
      },
    },
    execute: (input) => {
      const topic = typeof input.topic === "string" ? input.topic.toLowerCase() : "";
      const matches = topic
        ? FAQ.filter(
            (f) =>
              f.question.toLowerCase().includes(topic) ||
              f.answer.toLowerCase().includes(topic),
          )
        : FAQ;

      if (matches.length === 0) {
        return textResult(
          `No FAQ entries matched "${topic}". Known topics include: bot, privacy, price, mac, teams, zoom, calendar, jira.`,
        );
      }
      return textResult(
        matches.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n"),
      );
    },
  },
  {
    name: "get_download_link",
    description:
      "Returns the direct download URL and installation steps for the Brifo macOS app. Use when a user wants to install Brifo.",
    inputSchema: { type: "object", properties: {} },
    execute: () =>
      textResult(
        [
          `Download URL: ${DOWNLOAD_URL}`,
          "",
          "Installation steps:",
          "1. Open the downloaded .dmg file",
          "2. Drag Brifo.app into the Applications folder",
          "3. Launch Brifo (on first run: right-click → Open to bypass Gatekeeper)",
          "4. Grant the Microphone permission when prompted (Brifo listens via the mic only — no screen recording)",
          "5. Sign in with Google",
          "",
          "Requirements: macOS 12+ on Apple Silicon (M1/M2/M3/M4). Intel Macs are not supported.",
        ].join("\n"),
      ),
  },
  {
    name: "scroll_to_section",
    description:
      "Scrolls the Brifo landing page to the named section. Useful when an agent wants to surface a specific part of the page to the user.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Section to scroll to.",
          enum: [...SECTIONS],
        },
      },
      required: ["section"],
    },
    execute: (input) => {
      const section = input.section as Section;
      if (!SECTIONS.includes(section)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown section "${String(input.section)}". Valid sections: ${SECTIONS.join(", ")}.`,
            },
          ],
        };
      }
      const targetId = SECTION_ALIASES[section];
      const el =
        document.getElementById(targetId) ??
        document.querySelector(`[data-section="${targetId}"]`);
      if (!el) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Section "${section}" is not present on this page yet.`,
            },
          ],
        };
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return textResult(`Scrolled to section "${section}".`);
    },
  },
  {
    name: "get_agent_discovery_endpoints",
    description:
      "Returns the URLs agents can use to discover Brifo's API and capabilities (API catalog, OpenAPI spec, OAuth metadata, agent skills index).",
    inputSchema: { type: "object", properties: {} },
    execute: () =>
      textResult(
        [
          "Agent discovery endpoints:",
          "- API catalog (RFC 9727): https://brifo.in/.well-known/api-catalog",
          "- Agent skills index: https://brifo.in/.well-known/agent-skills/index.json",
          "- OpenAPI spec: https://api.brifo.in/api/docs-json",
          "- Swagger UI: https://api.brifo.in/api/docs",
          "- OAuth Protected Resource (RFC 9728): https://api.brifo.in/.well-known/oauth-protected-resource",
          "- OAuth Authorization Server (RFC 8414): https://api.brifo.in/.well-known/oauth-authorization-server",
          "- Health: https://api.brifo.in/api/health",
          "- Markdown version of homepage: https://brifo.in/ (send Accept: text/markdown) or https://brifo.in/index.md",
          "- llms.txt: https://brifo.in/llms.txt",
        ].join("\n"),
      ),
  },
];

let registered = false;

export async function registerWebMCPTools(): Promise<void> {
  if (registered) return;
  const mc = navigator.modelContext;
  if (!mc || typeof mc.provideContext !== "function") {
    return;
  }
  try {
    await mc.provideContext({ tools });
    registered = true;
  } catch {
    // Browser rejected the registration — nothing useful we can do on a
    // marketing page, so fail silently. The page still works for humans.
  }
}
