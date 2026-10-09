"use client";
import { useEffect, useState } from "react";
import { IconMic, IconSend } from "@/components/ui/Icons";

const PROMPTS = [
  "Build a lead generation form for my business, Northfield Gym",
  "Create a customer feedback survey for my cafe",
  "Make an event registration form for our meetup",
];

/** Types a prompt character by character, pauses, erases, then moves to the next one. */
function useTyping(texts: string[]): string {
  const [out, setOut] = useState(texts[0]);

  useEffect(() => {
    // Respect users who ask for less motion: show one static prompt.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0, n = 0, erasing = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = texts[i];
      if (!erasing) {
        n++;
        setOut(full.slice(0, n));
        if (n === full.length) { erasing = true; t = setTimeout(tick, 2000); return; }
        t = setTimeout(tick, 45);
      } else {
        n -= 2;
        if (n <= 0) { n = 0; erasing = false; i = (i + 1) % texts.length; setOut(""); t = setTimeout(tick, 350); return; }
        setOut(full.slice(0, n));
        t = setTimeout(tick, 16);
      }
    };
    setOut("");
    t = setTimeout(tick, 500);
    return () => clearTimeout(t);
  }, [texts]);

  return out;
}

export function HeroCards() {
  const typed = useTyping(PROMPTS);
  return (
    <div className="hero-cards">
      {/* 1. describe the form you want */}
      <div className="hero-card">
        <div className="hc-glow" />
        <div className="hc-prompt">
          <p>{typed}<span className="caret" aria-hidden /></p>
          <div className="hc-prompt-row">
            <IconMic size={16} />
            <IconSend size={16} />
          </div>
        </div>
      </div>

      {/* 2. the generated, conversational form */}
      <div className="hero-card">
        <div className="hc-glow" />
        <div className="hc-device">
          <div className="mock-split">
            <div className="mock-left">
              <small>Northfield Gym</small>
              <h4>Enjoying the Power Circuit class?</h4>
              <div className="mock-stars" aria-hidden>{"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}</div>
            </div>
            <div className="mock-photo" aria-hidden><span /></div>
          </div>
        </div>
      </div>

      {/* 3. a booking form that triggers workflows */}
      <div className="hero-card">
        <div className="hc-glow" />
        <div className="hc-device">
          <div className="mock-booking">
            <small>Northfield Gym</small>
            <h4>Book a class now</h4>
            <div className="mock-form">
              <label>Full name<span>Robin Smith</span></label>
              <label>Email<span>robin@example.com</span></label>
              <button tabIndex={-1} aria-hidden>Book class</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
