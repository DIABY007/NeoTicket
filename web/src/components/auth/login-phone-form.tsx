"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { NeoTicketLogo } from "@/components/neo-ticket-logo";
import { PhoneInput } from "@/components/phone-input";

const BURKINA_PREFIX = "+226";

type LoginPhoneFormProps = {
  shouldRedirectOnSuccess?: boolean;
  redirectTo?: string;
};

export function LoginPhoneForm({
  shouldRedirectOnSuccess = true,
  redirectTo,
}: LoginPhoneFormProps) {
  const router = useRouter();
  const { setAuthUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const isDigitsOnly = /^\d*$/.test(phoneDigits);
  const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
  const isDisplayNameValid =
    normalizedDisplayName.length >= 2 && normalizedDisplayName.length <= 80;
  const isValidForStep = phoneDigits.length >= 8 && isDigitsOnly;
  const isOtpValid = /^\d{6}$/.test(otpCode);

  const e164Preview = useMemo(() => {
    if (!phoneDigits) {
      return "";
    }

    return `${BURKINA_PREFIX}${phoneDigits}`;
  }, [phoneDigits]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldown]);

  const sendOtp = async () => {
    setSubmitted(true);
    setError(null);
    setFeedback(null);

    if (!isValidForStep) {
      return;
    }

    if (!isDisplayNameValid) {
      setError("Entrez votre nom (2 a 80 caracteres).");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164Preview }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Envoi OTP impossible.");
        if (payload.retryAfterSeconds) {
          setCooldown(payload.retryAfterSeconds);
        }
        return;
      }

      setFeedback(payload.message ?? "Code OTP envoye.");
      setStep("otp");
      setCooldown(payload.cooldownSeconds ?? 60);
    } catch {
      setError("Erreur reseau pendant l'envoi du code.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setFeedback(null);

    if (!isOtpValid) {
      setError("Le code OTP doit contenir 6 chiffres.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode, name: normalizedDisplayName }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        message?: string;
        redirectTo?: string;
        user?: {
          id: string;
          phone: string;
          displayName?: string | null;
          roles: string[];
        };
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Verification OTP impossible.");
        return;
      }

      setFeedback(payload.message ?? "Connexion reussie.");

      const navigateTo = (targetPath: string) => {
        // Hard redirect fallback avoids rare client-router stale states after cookie updates.
        router.replace(targetPath);
        window.location.assign(targetPath);
      };

      const handleAuthenticatedUser = (authenticatedUser: {
        id: string;
        phone: string;
        displayName?: string | null;
        roles: string[];
      }) => {
        setAuthUser(authenticatedUser);

        if (!shouldRedirectOnSuccess) {
          return;
        }

        // Only honor an explicit redirect target from the caller.
        // Defaulting to role-based routes caused unwanted admin dashboard redirects.
        const explicitRedirect = redirectTo;
        if (explicitRedirect) {
          navigateTo(explicitRedirect);
          return;
        }

        navigateTo("/");
      };

      if (payload.user) {
        handleAuthenticatedUser(payload.user);
        return;
      }

      // Fallback: reload session from /api/auth/me when backend did not include user.
      const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const mePayload = (await meResponse.json()) as {
        success: boolean;
        user?: {
          id: string;
          phone: string;
          displayName?: string | null;
          roles: string[];
        };
      };

      if (meResponse.ok && mePayload.success && mePayload.user) {
        handleAuthenticatedUser(mePayload.user);
      }
    } catch {
      setError("Erreur reseau pendant la verification du code.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === "phone") {
      await sendOtp();
      return;
    }

    await verifyOtp();
  };

  return (
    <form
      className="w-full max-w-sm rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="mb-2 flex items-center gap-2">
        <NeoTicketLogo size={36} />
        <span className="neo-gradient-text text-xl font-extrabold tracking-tight">NEOTICKET</span>
      </div>
      <h1 className="text-xl font-bold">Connexion</h1>
      <p className="mt-2 text-sm text-black/70">
        {step === "phone"
          ? "Saisissez votre numero pour recevoir le code OTP."
          : `Saisissez le code OTP recu sur ${e164Preview}.`}
      </p>

      {step === "phone" ? (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="display-name">
            Nom
          </label>
          <input
            id="display-name"
            name="display-name"
            type="text"
            autoComplete="name"
            placeholder="Ex: Awa Ouedraogo"
            value={displayName}
            maxLength={80}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSubmitted(false);
              setError(null);
            }}
            className="w-full neo-input rounded-xl px-3 py-3 text-base"
          />

          <label className="mb-2 mt-4 block text-sm font-medium" htmlFor="phone">
            Numero de telephone
          </label>
          <PhoneInput
            id="phone"
            name="phone"
            autoComplete="tel"
            value={phoneDigits}
            onChange={(digits) => {
              setPhoneDigits(digits);
              setSubmitted(false);
              setError(null);
            }}
            aria-describedby="phone-help"
          />
          <p id="phone-help" className="mt-2 text-xs text-black/60">
            Format attendu: 8 chiffres (ex: 70123456).
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="otp">
            Code OTP
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otpCode}
            maxLength={6}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/\D+/g, "");
              setOtpCode(nextValue);
              setError(null);
            }}
            className="w-full neo-input rounded-xl px-3 py-3 text-base"
          />
          <p className="mt-2 text-xs text-black/60">
            Entrez les 6 chiffres recus sur WhatsApp.
          </p>
        </div>
      )}

      {step === "phone" && submitted && !isDigitsOnly ? (
        <p className="mt-3 text-sm text-red-700">
          Le numero doit contenir uniquement des chiffres.
        </p>
      ) : null}

      {step === "phone" && submitted && !isDisplayNameValid ? (
        <p className="mt-3 text-sm text-red-700">Le nom doit contenir entre 2 et 80 caracteres.</p>
      ) : null}

      {step === "phone" && submitted && isDigitsOnly && !isValidForStep ? (
        <p className="mt-3 text-sm text-red-700">
          Entrez au minimum 8 chiffres pour continuer.
        </p>
      ) : null}

      {step === "phone" && submitted && isValidForStep ? (
        <p className="mt-3 text-sm text-neo-teal">
          Numero valide: {e164Preview}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {feedback ? <p className="mt-3 text-sm text-emerald-700">{feedback}</p> : null}

      {step === "otp" ? (
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-black/8 px-4 py-3 text-sm font-medium disabled:opacity-60 hover:border-neo-teal/30 transition"
          onClick={() => {
            void sendOtp();
          }}
          disabled={isLoading || cooldown > 0}
        >
          {cooldown > 0
            ? `Renvoyer le code dans ${cooldown}s`
            : "Renvoyer le code"}
        </button>
      ) : null}

      <button
        type="submit"
        className="neo-btn mt-5 w-full rounded-xl px-4 py-3 text-sm"
        disabled={isLoading}
      >
        {isLoading
          ? "Veuillez patienter..."
          : step === "phone"
            ? "Recevoir le code"
            : "Verifier le code"}
      </button>
    </form>
  );
}
