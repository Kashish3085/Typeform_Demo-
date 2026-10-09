"use client";
/**
 * The one-question-at-a-time experience.
 *
 * State machine (`step`):
 *   -1            welcome screen (only when the form has a welcome title)
 *   0 .. n-1      question i
 *   n             thank-you screen
 *
 * Transitions: when `step` changes we keep the previous screen mounted for
 * ~ANIM_MS as `leaving`, so it can play its exit animation while the new one
 * plays its enter animation (both are absolutely positioned and overlap).
 *
 * The same component powers the public page (`onSubmit` saves to the API) and
 * the builder's live preview (no `onSubmit`, nothing is saved).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { ApiError } from "@/lib/api";
import { readableText } from "@/lib/color";
import type { AnswerMap, AnswerValue, Question, FormSettings } from "@/lib/types";
import { isEmpty, validateAnswer } from "@/lib/validation";
import { QuestionInput } from "./QuestionInput";

const ANIM_MS = 450;

export interface RunnerForm extends FormSettings {
  title: string;
  questions: Question[];
}

interface Props {
  form: RunnerForm;
  /** Persist the answers. Throw ApiError (with fieldErrors) to report server-side validation problems. */
  onSubmit?: (answers: AnswerMap) => Promise<{ thank_you_title?: string; thank_you_message?: string } | void>;
  /** Start on this question (used by the builder preview to mirror the selected question). */
  startAt?: number;
  /** Disable keyboard handling (e.g. when the preview is shown beside editable fields). */
  keyboard?: boolean;
  preview?: boolean;
}

type Dir = "next" | "prev";

export function FormRunner({ form, onSubmit, startAt, keyboard = true, preview = false }: Props) {
  const toast = useToast();
  const n = form.questions.length;
  const hasWelcome = !!form.welcome_title && !preview;

  const initialStep = startAt != null ? Math.max(Math.min(startAt, n - 1), 0) : hasWelcome ? -1 : 0;
  const [step, setStep] = useState(initialStep);
  const stepRef = useRef(initialStep); // synchronous mirror of `step` so go() stays pure
  const [leaving, setLeaving] = useState<{ step: number; dir: Dir } | null>(null);
  const [dir, setDir] = useState<Dir>("next");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [errorNonce, setErrorNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState({ title: form.thank_you_title, message: form.thank_you_message });
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Builder preview: jump to whichever question is selected in the editor.
  useEffect(() => {
    if (startAt != null) go(Math.min(Math.max(startAt, 0), Math.max(n - 1, 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt]);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const go = useCallback((to: number) => {
    const from = stepRef.current;
    if (to === from) return;
    const d: Dir = to > from ? "next" : "prev";
    stepRef.current = to;
    setDir(d);
    setLeaving({ step: from, dir: d }); // keep the old screen mounted while it animates out
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setLeaving(null), ANIM_MS);
    setStep(to);
  }, []);

  const setAnswer = (q: Question, v: AnswerValue) => {
    setAnswers((a) => ({ ...a, [q.id]: v }));
    // clear the error as soon as the user edits
    setErrors((e) => {
      if (!(q.id in e)) return e;
      const { [q.id]: _drop, ...rest } = e;
      return rest;
    });
  };

  const fail = (qid: number, message: string) => {
    setErrors((e) => ({ ...e, [qid]: message }));
    setErrorNonce((x) => x + 1);
  };

  const submit = async () => {
    // Validate everything once more (user may have skipped back and edited).
    for (let i = 0; i < n; i++) {
      const q = form.questions[i];
      const err = validateAnswer(q, answers[q.id]);
      if (err) {
        go(i);
        fail(q.id, err);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = onSubmit ? await onSubmit(answers) : undefined;
      if (res) setThanks({ title: res.thank_you_title ?? thanks.title, message: res.thank_you_message ?? thanks.message });
      go(n);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        // Server rejected specific questions: jump to the first one and show its message.
        const map: Record<number, string> = {};
        Object.entries(e.fieldErrors).forEach(([id, msg]) => (map[Number(id)] = msg));
        setErrors(map);
        const firstIdx = form.questions.findIndex((q) => q.id in map);
        if (firstIdx >= 0) go(firstIdx);
        setErrorNonce((x) => x + 1);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const next = useCallback(() => {
    if (submitting) return;
    if (step === -1) return go(0);
    if (step >= n) return;
    const q = form.questions[step];
    const err = validateAnswer(q, answers[q.id]);
    if (err) return fail(q.id, err);
    if (step === n - 1) void submit();
    else go(step + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, n, answers, submitting, form.questions]);

  const prev = useCallback(() => {
    if (step > 0 && step < n) go(step - 1);
  }, [step, n, go]);

  // Global keyboard: Enter / ArrowDown -> next, ArrowUp -> previous.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (e.key === "Enter") {
        if (tag === "TEXTAREA" && e.shiftKey) return; // Shift+Enter = newline
        // Focused buttons activate natively on Enter (a click). Handling it here too
        // would fire twice and skip a question. Selects keep their native picker.
        if (tag === "BUTTON" || tag === "SELECT") return;
        e.preventDefault();
        next();
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && tag !== "TEXTAREA" && tag !== "SELECT" && !(tag === "INPUT" && (t as HTMLInputElement).type === "number")) {
        e.preventDefault();
        e.key === "ArrowDown" ? next() : prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, next, prev]);

  const answered = useMemo(
    () => form.questions.filter((q) => !isEmpty(answers[q.id])).length,
    [answers, form.questions],
  );
  const progress = step < 0 ? 0 : Math.min(step, n) / Math.max(n, 1);

  const accent = form.theme_button_color;
  const style = {
    "--tf-bg": form.theme_background,
    "--tf-text": form.theme_question_color,
    "--tf-accent": accent,
    "--tf-accent-text": readableText(accent),
    fontFamily: `"${form.theme_font}", var(--font-inter), system-ui, sans-serif`,
  } as React.CSSProperties;

  const renderScreen = (s: number, active: boolean) => {
    if (s === -1) {
      return (
        <div className="q-wrap">
          <h1 className="q-title welcome-title">{form.welcome_title}</h1>
          {form.welcome_description && <p className="q-desc">{form.welcome_description}</p>}
          <div className="q-actions">
            <button className="ok-btn ok-btn-lg" onClick={next} disabled={!active}>
              {form.welcome_button || "Start"}
            </button>
            <span className="hint">press <b>Enter ↵</b></span>
          </div>
        </div>
      );
    }
    if (s >= n) {
      return (
        <div className="q-wrap">
          <div className="thanks-check">✓</div>
          <h1 className="q-title">{thanks.title}</h1>
          {thanks.message && <p className="q-desc">{thanks.message}</p>}
          {preview && <p className="hint">Preview only - nothing was saved.</p>}
        </div>
      );
    }
    const q = form.questions[s];
    const isLast = s === n - 1;
    return (
      <div className="q-wrap">
        <div className="q-head">
          <span className="q-num">
            {s + 1}
            <span className="q-arrow">→</span>
          </span>
          <h2 className="q-title">
            {q.title || <span className="q-untitled">Your question here</span>}
            {q.required && <span className="req" aria-label="required"> *</span>}
          </h2>
        </div>
        {q.description && <p className="q-desc q-desc-indent">{q.description}</p>}
        <div className="q-input">
          <QuestionInput
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q, v)}
            active={active}
            onAutoAdvance={!isLast ? next : undefined}
          />
        </div>
        {errors[q.id] && active && (
          <div key={errorNonce} className="q-error" role="alert">
            ⚠ {errors[q.id]}
          </div>
        )}
        <div className="q-actions">
          <button className="ok-btn" onClick={next} disabled={!active || submitting}>
            {isLast ? (submitting ? "Submitting…" : "Submit") : "OK"} {!isLast && <span>✓</span>}
          </button>
          <span className="hint">
            {q.type === "long_text" ? (
              <>
                <b>Shift ⇧ + Enter ↵</b> to make a line break
              </>
            ) : (
              <>
                press <b>Enter ↵</b>
              </>
            )}
          </span>
        </div>
      </div>
    );
  };

  if (n === 0) {
    return (
      <div className="runner" style={style}>
        <div className="screen">
          <div className="q-wrap">
            <p className="q-desc">This form has no questions yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="runner" style={style}>
      <div className="progress-track" aria-hidden>
        <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="runner-stage">
        {leaving && (
          <div key={`out-${leaving.step}`} className={`screen slide-out-${leaving.dir}`} aria-hidden>
            {renderScreen(leaving.step, false)}
          </div>
        )}
        <div key={`in-${step}`} className={`screen ${leaving ? `slide-in-${dir}` : ""}`}>
          {renderScreen(step, true)}
        </div>
      </div>

      {step >= 0 && step < n && (
        <div className="runner-footer">
          <div className="progress-text">
            {answered} of {n} answered
          </div>
          <div className="nav-btns">
            <button className="nav-btn" onClick={prev} disabled={step === 0} aria-label="Previous question">
              ▲
            </button>
            <button className="nav-btn" onClick={next} disabled={step >= n - 1} aria-label="Next question">
              ▼
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
