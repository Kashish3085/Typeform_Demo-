import type { QuestionType } from "./types";

export interface QuestionTypeMeta {
  type: QuestionType;
  label: string;
  icon: string; // short glyph shown in the sidebar / picker
  color: string; // tile colour in the type picker
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { type: "short_text", label: "Short text", icon: "Aa", color: "#F4B183" },
  { type: "long_text", label: "Long text", icon: "¶", color: "#F4B183" },
  { type: "multiple_choice", label: "Multiple choice", icon: "☰", color: "#8FBF9F" },
  { type: "dropdown", label: "Dropdown", icon: "▾", color: "#8FBF9F" },
  { type: "yes_no", label: "Yes / No", icon: "✓", color: "#8FBF9F" },
  { type: "rating", label: "Rating", icon: "★", color: "#A9A2D8" },
  { type: "email", label: "Email", icon: "@", color: "#F4B183" },
  { type: "number", label: "Number", icon: "#", color: "#A9A2D8" },
];

export const typeMeta = (t: QuestionType): QuestionTypeMeta =>
  QUESTION_TYPES.find((q) => q.type === t) ?? QUESTION_TYPES[0];

export const FONTS = ["Inter", "Georgia", "Merriweather", "Courier New", "Trebuchet MS"];
