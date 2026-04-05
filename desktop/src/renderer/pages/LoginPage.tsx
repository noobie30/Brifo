import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { connectGoogleCalendar, signInWithGoogle } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { Button, Badge } from "../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAppStore((state) => state.setSession);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const termsUrl =
    import.meta.env.VITE_TERMS_URL?.trim() || "https://brifo.app/terms";
  const privacyUrl =
    import.meta.env.VITE_PRIVACY_URL?.trim() || "https://brifo.app/privacy";

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm animate-fade-in">
        <div className="flex justify-center mb-6">
          <BrandLogo />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">
          Welcome to Brifo
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Choose your work account to get started.
        </p>

        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
        >
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent-100 text-accent-700 text-xs font-bold">
            G
          </span>
          <span>{isLoading ? "Signing in..." : "Sign in with Google"}</span>
          {lastUsedEmail && (
            <Badge variant="accent" size="sm">
              Last used
            </Badge>
          )}
        </button>

        {lastUsedEmail && (
          <p className="text-xs text-gray-400 text-center mt-2">
            {lastUsedEmail}
          </p>
        )}

        <label className="flex items-start gap-2.5 mt-5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500 leading-relaxed">
            I agree to the{" "}
            <a
              href={termsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-600 hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href={privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-600 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="mt-4 rounded-lg bg-error-50 border border-error-500/20 px-3 py-2.5">
            <p className="text-xs text-error-700 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
