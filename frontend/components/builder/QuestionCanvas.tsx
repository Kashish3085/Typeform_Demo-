"use client";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { QuestionInput } from "@/components/respondent/QuestionInput";
import type { BuilderQuestion, Choice } from "@/lib/types";

interface Props {
  question: BuilderQuestion;
  index: number;
  onChange: (patch: Partial<BuilderQuestion>) => void;
}

const newChoiceId = () => "c" + Math.random().toString(36).slice(2, 8);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Centre pane: edit the title, description and (for choice types) the options inline. */
export function QuestionCanvas({ question: q, index, onChange }: Props) {
  const choices = q.properties.choices ?? [];
  const setChoices = (next: Choice[]) => onChange({ properties: { ...q.properties, choices: next } });

  return (
    <div className="canvas">
      <div className="canvas-card">
        <div className="q-head">
          <span className="q-num">
            {index + 1}
            <span className="q-arrow">→</span>
          </span>
          <AutoTextarea
            className="inline-title"
            placeholder="Your question here"
            value={q.title}
            maxLength={500}
            autoFocus={!q.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label="Question title"
          />
          {q.required && <span className="req">*</span>}
        </div>

        <input
          className="inline-desc"
          placeholder="Description (optional)"
          value={q.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          aria-label="Question description"
        />

        {q.type === "multiple_choice" || q.type === "dropdown" ? (
          <div className="choice-editor">
            {choices.map((c, i) => (
              <div className="choice-edit-row" key={c.id}>
                <span className="choice-key">{q.type === "multiple_choice" ? LETTERS[i] : i + 1}</span>
                <input
                  className="choice-edit-input"
                  value={c.label}
                  placeholder={`Choice ${i + 1}`}
                  onChange={(e) => setChoices(choices.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const at = choices.findIndex((x) => x.id === c.id);
                      const next = [...choices];
                      next.splice(at + 1, 0, { id: newChoiceId(), label: "" });
                      setChoices(next);
                    }
                  }}
                />
                <button
                  className="icon-btn"
                  aria-label="Remove choice"
                  disabled={choices.length <= 1}
                  onClick={() => setChoices(choices.filter((x) => x.id !== c.id))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setChoices([...choices, { id: newChoiceId(), label: `Choice ${choices.length + 1}` }])}
            >
              + Add choice
            </button>
          </div>
        ) : (
          // Non-interactive preview of the answer control
          <div className="canvas-input" aria-hidden>
            <QuestionInput question={q} value={undefined} onChange={() => {}} active={false} />
          </div>
        )}
      </div>
    </div>
  );
}
