"use client";
import { Switch } from "@/components/ui/Switch";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import type { BuilderQuestion, QuestionType } from "@/lib/types";

interface Props {
  question: BuilderQuestion;
  onChange: (patch: Partial<BuilderQuestion>) => void;
  onChangeType: (t: QuestionType) => void;
}

const toNum = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Right panel, "Question" tab: per-question settings. */
export function QuestionSettings({ question: q, onChange, onChangeType }: Props) {
  const setProps = (patch: Record<string, unknown>) => onChange({ properties: { ...q.properties, ...patch } });

  return (
    <div className="panel-section">
      <label className="field">
        <span className="field-label">Question type</span>
        <select className="select" value={q.type} onChange={(e) => onChangeType(e.target.value as QuestionType)}>
          {QUESTION_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="muted small">Changing the type resets type-specific options.</span>
      </label>

      <Switch label="Required" hint="Respondents must answer to continue" checked={q.required} onChange={(v) => onChange({ required: v })} />

      {q.type === "multiple_choice" && (
        <Switch
          label="Multiple selection"
          hint="Let people choose more than one option"
          checked={!!q.properties.allow_multiple}
          onChange={(v) => setProps({ allow_multiple: v })}
        />
      )}

      {(q.type === "short_text" || q.type === "long_text") && (
        <>
          <label className="field">
            <span className="field-label">Placeholder</span>
            <input className="text-input" value={q.properties.placeholder ?? ""} onChange={(e) => setProps({ placeholder: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Character limit</span>
            <input
              className="text-input"
              type="number"
              min={1}
              placeholder="No limit"
              value={q.properties.max_length ?? ""}
              onChange={(e) => setProps({ max_length: toNum(e.target.value) })}
            />
          </label>
        </>
      )}

      {q.type === "number" && (
        <div className="field-row">
          <label className="field">
            <span className="field-label">Min</span>
            <input className="text-input" type="number" value={q.properties.min ?? ""} onChange={(e) => setProps({ min: toNum(e.target.value) })} />
          </label>
          <label className="field">
            <span className="field-label">Max</span>
            <input className="text-input" type="number" value={q.properties.max ?? ""} onChange={(e) => setProps({ max: toNum(e.target.value) })} />
          </label>
        </div>
      )}

      {q.type === "rating" && (
        <label className="field">
          <span className="field-label">Number of stars</span>
          <select className="select" value={q.properties.max ?? 5} onChange={(e) => setProps({ max: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
