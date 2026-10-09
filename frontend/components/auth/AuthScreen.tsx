"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { ApiError } from "@/lib/api";
import { safeNext, useAuth } from "@/lib/auth";
import { AuthShell } from "./AuthShell";

type Mode = "login" | "signup";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 01-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z" />
    <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0012 24z" />
    <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 010-4.6v-3H1.8a12 12 0 000 10.6l3.8-3z" />
    <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 001.8 7.1l3.8 3C6.5 6.8 9 4.8 12 4.8z" />
  </svg>
);
const MicrosoftLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" /><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
    <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" /><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
  </svg>
);

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { status, login, signup } = useAuth();
  const next = safeNext(params.get("next"));
  const isSignup = mode === "signup";

  const [step, setStep] = useState<"choose" | "email">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; agree?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  // Already logged in? Skip straight to the app.
  useEffect(() => {
    if (status === "authed") router.replace(next);
  }, [status, next, router]);

  const oauth = (provider: string) =>
    toast.info(`${provider} sign-in isn't set up in this demo. Use email instead.`);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address";
    if (isSignup && password.length < 8) errs.password = "Use at least 8 characters";
    if (!isSignup && !password) errs.password = "Enter your password";
    if (isSignup && !agree) errs.agree = "Please accept the terms to continue";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      if (isSignup) await signup(email.trim(), password, name.trim() || undefined);
      else await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setErrors({ form: msg });
      setBusy(false);
    }
  };

  const useDemo = () => {
    setEmail("demo@example.com");
    setPassword("demo1234");
    setErrors({});
    setStep("email");
  };

  return (
    <AuthShell mode={mode}>
      <h1 className="auth-title">
        {isSignup ? "Sign up today. Start with a form, end with a conversation." : "Welcome back. Log in to your account."}
      </h1>

      {step === "choose" ? (
        <div className="auth-actions">
          <button className="auth-btn" onClick={() => oauth("Google")}><GoogleG /> {isSignup ? "Sign up" : "Log in"} with Google</button>
          <button className="auth-btn" onClick={() => oauth("Microsoft")}><MicrosoftLogo /> {isSignup ? "Sign up" : "Log in"} with Microsoft</button>
          <p className="auth-or">OR</p>
          <button className="auth-btn auth-btn-primary" onClick={() => setStep("email")}>
            {isSignup ? "Sign up" : "Log in"} with email
          </button>
          {!isSignup && (
            <button className="auth-demo" onClick={useDemo}>Use the demo account</button>
          )}
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          {isSignup && (
            <label className="field">
              <span className="field-label">Full name <span className="muted">(optional)</span></span>
              <input className="text-input" autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className={`text-input ${errors.email ? "input-error" : ""}`}
              type="email" autoComplete="email" autoFocus inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="pw-wrap">
              <input
                className={`text-input ${errors.password ? "input-error" : ""}`}
                type={show ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128}
                aria-invalid={!!errors.password}
              />
              <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? "Hide" : "Show"}
              </button>
            </span>
            {errors.password ? (
              <span className="field-error" role="alert">{errors.password}</span>
            ) : isSignup ? (
              <span className="muted small">At least 8 characters</span>
            ) : null}
          </label>

          {isSignup && (
            <label className="check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I agree to the terms of service and privacy policy of this demo.</span>
            </label>
          )}
          {errors.agree && <span className="field-error" role="alert">{errors.agree}</span>}

          {errors.form && (
            <div className="form-error" role="alert">
              {errors.form}{" "}
              {isSignup && errors.form.includes("already exists") && <Link href="/login">Log in instead</Link>}
            </div>
          )}

          <button className="auth-btn auth-btn-primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create my free account" : "Log in"}
          </button>
          {!isSignup && (
            <button type="button" className="auth-link" onClick={() => toast.info("Password reset isn't available in this demo (no email service).")}>
              Forgot your password?
            </button>
          )}
          <button type="button" className="auth-link" onClick={() => { setStep("choose"); setErrors({}); }}>← Back</button>
        </form>
      )}
    </AuthShell>
  );
}
