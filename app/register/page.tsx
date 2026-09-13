"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "details" | "verify" | "password";

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

const labelClass = "block text-sm font-medium text-zinc-300";

const buttonClass =
  "w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [devCode, setDevCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);

    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (isResend: boolean) => {
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not send the verification code");

        if (data.retryAfterSeconds) {
          setResendIn(data.retryAfterSeconds);
        }

        return;
      }

      setDevCode(data.devCode || "");
      setResendIn(data.resendAfterSeconds || 60);
      setCode("");
      setStep("verify");
      setNotice(
        isResend
          ? `A new code is on its way to ${email}.`
          : `We sent a 6-digit code to ${email}.`
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode(false);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      setVerificationToken(data.verificationToken);
      setStep("password");
      setNotice("Email verified. Choose a password to finish.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    setStep("details");
    setCode("");
    setVerificationToken("");
    setDevCode("");
    setError("");
    setNotice("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-semibold text-zinc-950">
            AI
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            {step === "details" && "Create your account"}
            {step === "verify" && "Verify your email"}
            {step === "password" && "Set your password"}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {step === "details" ? (
              <>
                Or{" "}
                <a
                  href="/login"
                  className="font-medium text-white hover:text-zinc-300"
                >
                  sign in to existing account
                </a>
              </>
            ) : (
              <>Step {step === "verify" ? 2 : 3} of 3</>
            )}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
            {notice}
          </div>
        )}

        {devCode && step === "verify" && (
          <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-xs text-zinc-400">
            Email delivery is off in this environment. Your code is{" "}
            <span className="font-mono text-white">{devCode}</span>
          </div>
        )}

        {step === "details" && (
          <form className="space-y-6" onSubmit={handleDetailsSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  We&apos;ll send a 6-digit code to confirm it&apos;s yours
                </p>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={buttonClass}>
              {isLoading ? "Sending code..." : "Send verification code"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <form className="space-y-6" onSubmit={handleVerifySubmit}>
            <div>
              <label htmlFor="code" className={labelClass}>
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
                placeholder="000000"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Sent to {email}. The code expires in 10 minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className={buttonClass}
            >
              {isLoading ? "Verifying..." : "Verify email"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={restart}
                className="text-zinc-400 hover:text-white"
              >
                Use a different email
              </button>
              <button
                type="button"
                onClick={() => sendCode(true)}
                disabled={isLoading || resendIn > 0}
                className="text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form className="space-y-6" onSubmit={handlePasswordSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={buttonClass}>
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
