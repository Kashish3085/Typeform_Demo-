"use client";
import { useEffect, useRef } from "react";
import type { AnswerValue, Question } from "@/lib/types";

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  /** true only for the question currently on screen (drives focus + keyboard shortcuts) */
  active: boolean;
  /** called ~350ms after a single-choice selection so the flow feels fluid */
  onAutoAdvance?: () => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

export function QuestionInput({ question: q, value, onChange, active, onAutoAdvance }: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Always call the *latest* onAutoAdvance. The timer fires 350ms after the click,
  // by which time the parent has re-rendered with the new answer; calling the
  // callback captured at click time would validate the OLD (empty) answer.
  const advanceRef = useRef(onAutoAdvance);
  advanceRef.current = onAutoAdvance;

  useEffect(() => () => clearTimeout(timer.current), []);

  // Focus the field once the slide-in animation has mostly finished.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    return () => clearTimeout(t);
  }, [active, q.id]);

  const choose = (v: AnswerValue, advance: boolean) => {
    onChange(v);
    if (advance && advanceRef.current) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => advanceRef.current?.(), 350);
    }
  };

  // Keyboard shortcuts (A/B/C..., Y/N, 1-5) - only for the visible question and
  // only when the user isn't typing in a field.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (q.type === "multiple_choice") {
        const idx = LETTERS.toLowerCase().indexOf(k);
        const c = q.properties.choices?.[idx];
        if (k.length === 1 && c) {
          e.preventDefault();
          toggleChoice(c.id);
        }
      } else if (q.type === "yes_no" && (k === "y" || k === "n")) {
        e.preventDefault();
        choose(k === "y", true);
      } else if (q.type === "rating" && /^[1-9]$/.test(k) && Number(k) <= (q.properties.max ?? 5)) {
        e.preventDefault();
        choose(Number(k), true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q, value]);

  const toggleChoice = (id: string) => {
    if (q.properties.allow_multiple) {
      const cur = Array.isArray(value) ? value : [];
      onChange(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    } else {
      choose(id, true);
    }
  };

  switch (q.type) {
    case "short_text":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="answer-input"
          value={typeof value === "string" ? value : ""}
          placeholder={q.properties.placeholder || "Type your answer here..."}
          maxLength={q.properties.max_length ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "email":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="answer-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={typeof value === "string" ? value : ""}
          placeholder="name@example.com"
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="answer-input"
          type="number"
          inputMode="decimal"
          value={value === null || value === undefined ? "" : String(value)}
          min={q.properties.min ?? undefined}
          max={q.properties.max ?? undefined}
          placeholder="Type a number..."
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "long_text":
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="answer-input answer-textarea"
          rows={3}
          value={typeof value === "string" ? value : ""}
          placeholder={q.properties.placeholder || "Type your answer here..."}
          maxLength={q.properties.max_length ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "dropdown":
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          className="answer-input answer-select"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select an option</option>
          {q.properties.choices?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      );

    case "multiple_choice": {
      const selected = Array.isArray(value) ? value : value ? [value as string] : [];
      return (
        <div className="choices" role={q.properties.allow_multiple ? "group" : "radiogroup"}>
          {q.properties.allow_multiple && <div className="hint-small">Choose as many as you like</div>}
          {q.properties.choices?.map((c, i) => (
            <button
              type="button"
              key={c.id}
              className={`choice ${selected.includes(c.id) ? "choice-selected" : ""}`}
              role={q.properties.allow_multiple ? "checkbox" : "radio"}
              aria-checked={selected.includes(c.id)}
              onClick={() => toggleChoice(c.id)}
            >
              <span className="choice-key">{LETTERS[i]}</span>
              <span className="choice-label">{c.label}</span>
              {selected.includes(c.id) && <span className="choice-check">✓</span>}
            </button>
          ))}
        </div>
      );
    }

    case "yes_no":
      return (
        <div className="choices choices-inline" role="radiogroup">
          {[
            { v: true, label: "Yes", key: "Y" },
            { v: false, label: "No", key: "N" },
          ].map((o) => (
            <button
              type="button"
              key={o.label}
              className={`choice ${value === o.v ? "choice-selected" : ""}`}
              role="radio"
              aria-checked={value === o.v}
              onClick={() => choose(o.v, true)}
            >
              <span className="choice-key">{o.key}</span>
              <span className="choice-label">{o.label}</span>
              {value === o.v && <span className="choice-check">✓</span>}
            </button>
          ))}
        </div>
      );

    case "rating": {
      const max = q.properties.max ?? 5;
      return (
        <div className="rating" role="radiogroup">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              className={`rating-star ${typeof value === "number" && n <= value ? "rating-on" : ""}`}
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} of ${max}`}
              onClick={() => choose(n, true)}
            >
              <span className="rating-glyph">★</span>
              <span className="rating-num">{n}</span>
            </button>
          ))}
        </div>
      );
    }
  }
}
