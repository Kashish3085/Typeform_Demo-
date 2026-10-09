"use client";
import { IconClose, IconSparkle } from "@/components/ui/Icons";

export interface Suggestion {
  id: string;
  template: string;
  text: string;
}

export const SUGGESTIONS: Suggestion[] = [
  { id: "feedback", template: "feedback", text: "Form to collect audience feedback and ideas to improve and nurture content quality." },
  { id: "quiz", template: "quiz", text: "Interactive quiz to educate and retain audience attention with fun facts and tips." },
];

interface Props {
  items: Suggestion[];
  busy: boolean;
  onCreate: (template: string) => void;
  onDismiss: (id: string) => void;
}

/** AI-style template suggestions above the forms list. Dismissals persist per browser. */
export function SuggestionCards({ items, busy, onCreate, onDismiss }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="suggest-row">
      {items.map((s) => (
        <div key={s.id} className="suggest-card">
          <span className="suggest-icon"><IconSparkle size={18} /></span>
          <div className="suggest-body">
            <p>{s.text}</p>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => onCreate(s.template)}>
              Create form
            </button>
          </div>
          <button className="icon-btn suggest-x" aria-label="Dismiss suggestion" onClick={() => onDismiss(s.id)}>
            <IconClose size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
