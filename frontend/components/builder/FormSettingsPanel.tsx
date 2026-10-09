"use client";
import { Switch } from "@/components/ui/Switch";
import { FONTS } from "@/lib/questionTypes";
import type { Form } from "@/lib/types";

interface Props {
  form: Form;
  onChange: (patch: Partial<Form>) => void;
}

const PRESETS = [
  { name: "Classic", bg: "#FFFFFF", text: "#262627", accent: "#0445AF" },
  { name: "Midnight", bg: "#0B2C4D", text: "#FFFFFF", accent: "#3FA9F5" },
  { name: "Sunrise", bg: "#FFF4E5", text: "#4A2B0F", accent: "#E4572E" },
  { name: "Forest", bg: "#1E3A2F", text: "#F2F7F4", accent: "#7BD389" },
];

const COMING_SOON = ["Logic jumps & branching", "Integrations & webhooks", "Team collaboration & sharing", "File upload & payment questions"];

/** Right panel, "Form" tab: welcome / thank-you screens, theme, placeholders. */
export function FormSettingsPanel({ form, onChange }: Props) {
  const hasWelcome = form.welcome_title !== null && form.welcome_title !== "";

  return (
    <div className="panel-section">
      <h4 className="panel-h">Welcome screen</h4>
      <Switch
        label="Show welcome screen"
        checked={hasWelcome}
        onChange={(v) => onChange({ welcome_title: v ? "Welcome!" : null })}
      />
      {hasWelcome && (
        <>
          <label className="field">
            <span className="field-label">Title</span>
            <input className="text-input" value={form.welcome_title ?? ""} onChange={(e) => onChange({ welcome_title: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea className="text-input" rows={2} value={form.welcome_description ?? ""} onChange={(e) => onChange({ welcome_description: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Button text</span>
            <input className="text-input" value={form.welcome_button} onChange={(e) => onChange({ welcome_button: e.target.value })} />
          </label>
        </>
      )}

      <h4 className="panel-h">Thank-you screen</h4>
      <label className="field">
        <span className="field-label">Title</span>
        <input className="text-input" value={form.thank_you_title} onChange={(e) => onChange({ thank_you_title: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">Message</span>
        <textarea className="text-input" rows={2} value={form.thank_you_message} onChange={(e) => onChange({ thank_you_message: e.target.value })} />
      </label>

      <h4 className="panel-h">Theme</h4>
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="preset"
            title={p.name}
            style={{ background: p.bg, color: p.text }}
            onClick={() => onChange({ theme_background: p.bg, theme_question_color: p.text, theme_button_color: p.accent })}
          >
            Aa
            <span className="preset-dot" style={{ background: p.accent }} />
          </button>
        ))}
      </div>
      <div className="color-grid">
        {(
          [
            ["Background", "theme_background"],
            ["Questions", "theme_question_color"],
            ["Buttons & answers", "theme_button_color"],
          ] as const
        ).map(([label, key]) => (
          <label className="color-field" key={key}>
            <input type="color" value={form[key]} onChange={(e) => onChange({ [key]: e.target.value.toUpperCase() })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <label className="field">
        <span className="field-label">Font</span>
        <select className="select" value={form.theme_font} onChange={(e) => onChange({ theme_font: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>

      <h4 className="panel-h">More</h4>
      <ul className="soon-list">
        {COMING_SOON.map((s) => (
          <li key={s}>
            {s} <span className="badge">Coming soon</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
