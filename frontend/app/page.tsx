"use client";
import Link from "next/link";
import { AskTy } from "@/components/marketing/AskTy";
import { Brand } from "@/components/marketing/Brand";
import { HeroCards } from "@/components/marketing/HeroCards";
import { IconAutomations, IconContacts, IconForms, IconInsights, IconPages, IconResearch } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  { icon: <IconForms size={24} />, title: "Forms", text: "Ask one question at a time. Conversational forms that people actually finish." },
  { icon: <IconContacts size={24} />, title: "Contacts", text: "Keep everyone who responds in one place, ready for your next move." },
  { icon: <IconAutomations size={24} />, title: "Automations", text: "Trigger follow-ups and notifications the moment a response comes in." },
  { icon: <IconInsights size={24} />, title: "Insights", text: "See completion rates and answer breakdowns without exporting a thing." },
  { icon: <IconPages size={24} />, title: "Pages", text: "Wrap your form in a simple page you can share anywhere." },
  { icon: <IconResearch size={24} />, title: "Research Flow", text: "Run structured studies and keep every answer organised." },
];

const STEPS = [
  { n: "1", title: "Describe or build", text: "Start from a template or add questions in the drag-and-drop builder." },
  { n: "2", title: "Share a link", text: "Publish and send the link. Nobody needs an account to respond." },
  { n: "3", title: "Act on answers", text: "Review responses, spot trends and export to CSV." },
];

const LOGOS = ["Northwind", "Acme Co.", "Globex", "Initech", "Umbrella"]; // fictional placeholder names

export default function Landing() {
  const { status } = useAuth();
  const authed = status === "authed";

  return (
    <div className="landing">
      <header className="l-nav">
        <Link href="/" aria-label="Home"><Brand /></Link>
        <div className="l-nav-right">
          {authed ? (
            <Link href="/dashboard" className="btn-light">Go to dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="l-link">Log in</Link>
              <Link href="/signup" className="btn-light">Sign up</Link>
            </>
          )}
        </div>
      </header>

      <section className="l-hero">
        <p className="l-eyebrow">FORMS &amp; WORKFLOWS</p>
        <h1 className="l-title">The form is just the beginning</h1>
        <p className="l-sub">
          Collect, analyze, and act on customer data
          <br />
          with the complete platform for forms &amp; workflows.
        </p>
        <Link href={authed ? "/dashboard" : "/signup"} className="btn-light btn-light-lg">
          {authed ? "Open your dashboard" : "Get started—it's free"}
        </Link>
      </section>

      <HeroCards />

      <section className="l-section">
        <h2 className="l-h2">One place for every step, from first question to follow-up</h2>
        <div className="l-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="l-feature">
              <span className="l-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="l-section l-steps-wrap">
        <h2 className="l-h2">From idea to responses in minutes</h2>
        <div className="l-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="l-step">
              <span className="l-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section l-logos">
        <p>Built for teams of every size</p>
        <div className="l-logo-row">{LOGOS.map((l) => <span key={l}>{l}</span>)}</div>
      </section>

      <section className="l-cta">
        <h2 className="l-title l-title-sm">Start with a form, end with a conversation</h2>
        <Link href={authed ? "/dashboard" : "/signup"} className="btn-light btn-light-lg">
          {authed ? "Open your dashboard" : "Create your free account"}
        </Link>
      </section>

      <footer className="l-footer">
        <Brand size={18} />
        <p>
          A coding-assignment demo. Not affiliated with, endorsed by, or connected to Typeform.
        </p>
      </footer>

      <AskTy />
    </div>
  );
}
