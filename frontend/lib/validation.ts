// Client-side validation. Mirrors backend/app/question_types.py::validate_answer.
// This exists for instant feedback only - the server is the source of truth.
import type { AnswerValue, Question } from "./types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const isEmpty = (v: AnswerValue | undefined): boolean =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Returns an error message, or null when the answer is valid. */
export function validateAnswer(q: Question, value: AnswerValue | undefined): string | null {
  if (isEmpty(value)) return q.required ? "Please fill this in" : null;

  switch (q.type) {
    case "short_text":
    case "long_text": {
      const max = q.properties.max_length;
      if (typeof value === "string" && max && value.length > max) return `Must be at most ${max} characters`;
      return null;
    }
    case "email":
      return typeof value === "string" && EMAIL_RE.test(value.trim()) ? null : "Hmm... that email doesn't look right";
    case "number": {
      const n = Number(value);
      if (typeof value === "boolean" || Number.isNaN(n) || !Number.isFinite(n)) return "Please enter a number";
      const { min, max } = q.properties;
      if (min != null && n < min) return `Must be at least ${min}`;
      if (max != null && n > max) return `Must be at most ${max}`;
      return null;
    }
    default:
      return null; // choice/rating/yes_no values come from controlled widgets
  }
}
