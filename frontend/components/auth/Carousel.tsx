"use client";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    eyebrow: "Forms",
    title: "Ask less, learn more",
    art: (
      <div className="art art-form">
        <div className="art-q">
          <small>1 →</small>
          <strong>How was your visit today?</strong>
          <div className="art-opts">
            <span>A &nbsp;Great</span>
            <span className="on">B &nbsp;Good</span>
            <span>C &nbsp;Could be better</span>
          </div>
          <button tabIndex={-1} aria-hidden>OK ✓</button>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Insights",
    title: "See the story in your responses",
    art: (
      <div className="art art-insights">
        <div className="art-card">
          <strong>Overall experience</strong>
          {[78, 52, 34, 12].map((w, i) => (
            <div key={i} className="art-bar"><i style={{ width: `${w}%` }} /></div>
          ))}
          <div className="art-kpis"><span><b>128</b>responses</span><span><b>86%</b>completed</span></div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Contacts & Automations",
    title: "Trigger actions that drive growth",
    art: (
      <div className="art art-flow">
        <div className="art-node"><b>Trigger</b><small>When a contact is added to a segment</small></div>
        <div className="art-link" />
        <div className="art-node"><b>Send email</b><small>To: Contact · Subject: Thanks for signing up</small></div>
        <div className="art-mail"><b>Welcome aboard</b><span /><span /><button tabIndex={-1} aria-hidden>Get started</button></div>
      </div>
    ),
  },
];

/** Auto-advancing marketing carousel with prev / play-pause / dots / next. */
export function Carousel() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [playing]);

  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);
  const s = SLIDES[i];

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label="Product highlights">
      <div className="car-stage">
        <div className="car-peek" aria-hidden />
        <div key={i} className="car-card" aria-live="polite">
          <p className="car-eyebrow">{s.eyebrow}</p>
          <h3>{s.title}</h3>
          {s.art}
        </div>
      </div>
      <div className="car-controls">
        <button onClick={() => go(i - 1)} aria-label="Previous slide">‹</button>
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <span className="car-dots">
          {SLIDES.map((_, n) => (
            <button key={n} className={n === i ? "on" : ""} onClick={() => go(n)} aria-label={`Slide ${n + 1}`} aria-current={n === i} />
          ))}
        </span>
        <button onClick={() => go(i + 1)} aria-label="Next slide">›</button>
      </div>
    </div>
  );
}
