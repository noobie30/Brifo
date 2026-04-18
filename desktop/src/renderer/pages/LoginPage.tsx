import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectGoogleCalendar, signInWithGoogle } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { BrifoMark, IconSparkles, IconCheck } from "../components/icons";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAppStore((state) => state.setSession);
  const authNotice = useAppStore((state) => state.authNotice);
  const setAuthNotice = useAppStore((state) => state.setAuthNotice);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const termsUrl =
    import.meta.env.VITE_TERMS_URL?.trim() || "https://brifo.in/terms";
  const privacyUrl =
    import.meta.env.VITE_PRIVACY_URL?.trim() || "https://brifo.in/privacy";

  const lastUsedEmail = useMemo(
    () => localStorage.getItem("brifo_last_google_email"),
    [],
  );

  async function onGoogleSignIn() {
    if (!acceptedTerms) {
      setError(
        "Please accept Terms of Service and Privacy Policy to continue.",
      );
      return;
    }

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const googleClientSecret =
      import.meta.env.VITE_GOOGLE_CLIENT_SECRET?.trim();
    if (!googleClientId) {
      setError(
        "Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID in desktop env.",
      );
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { idToken, accessToken, refreshToken, expiryDate } =
        await window.electronAPI.startGoogleAuth({
          clientId: googleClientId,
          ...(googleClientSecret ? { clientSecret: googleClientSecret } : {}),
        });
      const result = await signInWithGoogle({ idToken });
      localStorage.setItem("brifo_last_google_email", result.user.email);
      await setSession(result.accessToken, result.user);

      if (accessToken) {
        try {
          await connectGoogleCalendar({
            accessToken,
            refreshToken,
            expiryDate,
          });
        } catch {
          // Keep sign-in successful even if calendar bootstrap is temporarily unavailable.
        }
      }

      navigate("/home");
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Unable to sign in.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const benefits: Array<{ title: string; body: string }> = [
    {
      title: "No bot joins your call",
      body: "Brifo listens to your mic locally and turns conversations into structured notes.",
    },
    {
      title: "Tasks routed to Jira",
      body: "Action items with owners, priorities, and due dates — one click to push.",
    },
    {
      title: "Ready before you close the call",
      body: "Summaries, decisions, and follow-ups generated the moment the meeting ends.",
    },
  ];

  return (
    <div
      className="flex items-stretch min-h-screen"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* Left panel — brand + pitch */}
      <div
        className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{
          width: "44%",
          background: "var(--color-fg)",
          color: "var(--color-fg-inverse)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -80,
            right: -60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "var(--color-accent)",
            opacity: 0.3,
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        <div className="flex items-center gap-2.5 relative">
          <BrifoMark size={28} color="var(--color-accent)" />
          <span className="text-[15px] font-semibold tracking-[-0.2px]">
            Brifo
          </span>
        </div>

        <div className="relative max-w-[460px]">

          <h1
            className="serif text-[44px] leading-[1.08] tracking-[-1.2px] font-medium mb-5"
            style={{ color: "var(--color-fg-inverse)" }}
          >
            Your meetings, turned into documents and tasks — without lifting a
            finger.
          </h1>
          <p
            className="text-[15px] leading-[1.6] max-w-[420px]"
            style={{ color: "rgba(250,250,247,0.72)" }}
          >
            Brifo captures your Mac&rsquo;s microphone during calls, drafts the
            notes, and pushes action items straight to Jira.
          </p>
        </div>

        <ul className="relative flex flex-col gap-3 max-w-[460px]">
          {benefits.map((b) => (
            <li key={b.title} className="flex items-start gap-3">
              <span
                className="inline-flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  background: "rgba(46,91,255,0.22)",
                  color: "#fff",
                }}
              >
                <IconCheck width={12} height={12} />
              </span>
              <div>
                <div className="text-[13.5px] font-medium text-white">
                  {b.title}
                </div>
                <div
                  className="text-[12.5px] leading-[1.55] mt-0.5"
                  style={{ color: "rgba(250,250,247,0.65)" }}
                >
                  {b.body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — sign-in */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="md:hidden flex items-center gap-2.5 mb-6">
            <BrifoMark size={28} />
            <span className="text-[15px] font-semibold tracking-[-0.2px] text-fg">
              Brifo
            </span>
          </div>

          <div className="eyebrow mb-2">Sign in</div>
          <h2 className="text-[22px] font-semibold tracking-[-0.4px] text-fg m-0">
            Welcome to Brifo
          </h2>
          <p className="mt-1.5 text-[13.5px] text-fg-muted">
            Use your Google account to get started — we&rsquo;ll also connect
            your calendar so Brifo can detect meetings.
          </p>

          {authNotice === "session-expired" && (
            <div
              className="mt-5 rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{
                background: "var(--color-warn-soft)",
                border: "1px solid rgba(179,92,0,0.18)",
              }}
            >
              <p
                className="text-[12px] leading-relaxed flex-1"
                style={{ color: "var(--color-warn)" }}
              >
                Your session ended. Please sign in again.
              </p>
              <button
                type="button"
                onClick={() => setAuthNotice(null)}
                className="text-[11.5px] font-medium cursor-pointer"
                style={{ color: "var(--color-warn)" }}
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void onGoogleSignIn()}
            disabled={isLoading}
            className="mt-5 brifo-btn brifo-btn-primary brifo-btn-lg w-full justify-center"
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              G
            </span>
            {isLoading ? "Signing in..." : "Sign in with Google"}
            {lastUsedEmail && (
              <span
                className="ml-1 mono text-[10.5px] px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Last used
              </span>
            )}
          </button>

          {lastUsedEmail && (
            <p className="mt-1.5 text-[11.5px] text-fg-subtle text-center mono">
              {lastUsedEmail}
            </p>
          )}

          <label className="flex items-start gap-2 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-[3px] h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent)]"
            />
            <span className="text-[11.5px] text-fg-muted leading-[1.55]">
              I agree to the{" "}
              <a
                href={termsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--color-border-strong)] hover:decoration-fg transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--color-border-strong)] hover:decoration-fg transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {error && (
            <div
              className="mt-4 rounded-md px-3 py-2.5 text-[12px]"
              style={{
                background: "var(--color-danger-soft)",
                color: "var(--color-danger)",
                border: "1px solid rgba(180,35,24,0.18)",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
