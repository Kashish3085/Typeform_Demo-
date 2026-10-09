// Mirrors backend/app/schemas.py. Keep in sync when the API contract changes.

export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "email"
  | "number"
  | "yes_no"
  | "rating";

export interface Choice {
  id: string;
  label: string;
}

export interface QuestionProps {
  choices?: Choice[];
  allow_multiple?: boolean;
  max?: number | null;
  min?: number | null;
  placeholder?: string;
  max_length?: number | null;
}

export interface Question {
  id: number;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  properties: QuestionProps;
}

export interface BuilderQuestion extends Question {
  form_id: number;
  position: number;
}

export interface ThemeFields {
  theme_background: string;
  theme_question_color: string;
  theme_button_color: string;
  theme_font: string;
}

export interface FormSettings extends ThemeFields {
  welcome_title: string | null;
  welcome_description: string | null;
  welcome_button: string;
  thank_you_title: string;
  thank_you_message: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Workspace {
  id: number;
  name: string;
  form_count: number;
}

export interface Usage {
  responses_collected: number;
  limit: number;
}

export interface Form extends FormSettings {
  id: number;
  workspace_id: number;
  title: string;
  status: "draft" | "published";
  slug: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  questions: BuilderQuestion[];
}

export interface FormSummary {
  id: number;
  workspace_id: number;
  title: string;
  status: "draft" | "published";
  slug: string;
  response_count: number;
  question_count: number;
  completion_rate: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PublicForm extends FormSettings {
  title: string;
  slug: string;
  questions: Question[];
}

export type AnswerValue = string | number | boolean | string[] | null;
export type AnswerMap = Record<number, AnswerValue>;

export interface ResponseListItem {
  id: number;
  started_at: string;
  submitted_at: string | null;
  answers: Record<string, string>;
}

export interface ResponseDetail {
  id: number;
  started_at: string;
  submitted_at: string | null;
  answers: {
    question_id: number;
    question_title: string;
    question_type: QuestionType;
    value: AnswerValue;
    display: string;
  }[];
}

export interface QuestionStats {
  question_id: number;
  title: string;
  type: QuestionType;
  answered: number;
  skipped: number;
  distribution: { label: string; count: number; percent: number }[] | null;
  average: number | null;
  samples: string[] | null;
}

export interface FormStats {
  total_responses: number;
  completed: number;
  completion_rate: number;
  questions: QuestionStats[];
}

export interface SubmitResult {
  id: number;
  thank_you_title: string;
  thank_you_message: string;
}
