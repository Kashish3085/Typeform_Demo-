"use client";
/**
 * "Ask Ty" floating helper on the landing page.
 * MOCK: canned FAQ answers only - there is no chatbot behind it.
 */
import { useState } from "react";
import { IconClose } from "@/components/ui/Icons";
import { LogoMark } from "./Brand";

const FAQ: { q: string; a: string }[] = [
  { q: "Is it free to start?", a: "Yes. Create an account and build your first form straight away - there is no payment step in this demo." },
  { q: "Do respondents need an account?", a: "No. Anyone with your form's link can fill it in; only creators need to sign up." },
  { q: "What question types are there?", a: "Short and long text, multiple choice, dropdown, email, number, yes/no and rating." },
];

export function AskTy() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="ty">
      {open && (
        <div className="ty-panel" role="dialog" aria-label="Ask Ty">
          <div className="ty-head">
            <strong>Ask Ty</strong>
            <button className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><IconClose size={16} /></button>
          </div>
          <p className="muted small">Hi! Pick a question - I&apos;m a demo helper with canned answers.</p>
          <div className="ty-list">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <button className="ty-q" onClick={() => setPicked(picked === i ? null : i)} aria-expanded={picked === i}>{f.q}</button>
                {picked === i && <p className="ty-a">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      <button className="ty-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <LogoMark size={18} /> Ask Ty
      </button>
    </div>
  );
}
