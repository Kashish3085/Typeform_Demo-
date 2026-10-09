"use client";
import Link from "next/link";
import { Brand, LogoMark } from "@/components/marketing/Brand";
import { Carousel } from "./Carousel";

const LOGOS = ["Northwind", "Acme Co.", "Globex", "Initech"]; // fictional placeholder names

/** Split layout used by /login and /signup: marketing carousel on the left, the form on the right. */
export function AuthShell({ mode, children }: { mode: "login" | "signup"; children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-left">
        <Link href="/" className="auth-home" aria-label="Home"><Brand size={20} /></Link>
        <Carousel />
        <div className="auth-trust">
          <p>Built for teams of every size.</p>
          <div className="auth-logos">{LOGOS.map((l) => <span key={l}>{l}</span>)}</div>
        </div>
      </aside>

      <main className="auth-right">
        <div className="auth-top">
          <label className="lang">
            <span aria-hidden>🌐</span>
            <select aria-label="Language" defaultValue="en">
              <option value="en">English</option>
            </select>
          </label>
          <span className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
            <Link href={mode === "signup" ? "/login" : "/signup"} className="btn btn-outline btn-sm">
              {mode === "signup" ? "Log in" : "Sign up"}
            </Link>
          </span>
        </div>

        <div className="auth-center">
          <div className="auth-logo"><LogoMark size={26} /> Typeform clone</div>
          {children}
          <p className="auth-demo-note">
            Demo project for a coding assignment, not affiliated with Typeform. Don&apos;t use a password you use elsewhere.
          </p>
        </div>
      </main>
    </div>
  );
}
