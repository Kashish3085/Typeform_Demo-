"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";

export type SaveState = "saved" | "saving" | "error";

interface Props {
  formId: number;
  title: string;
  status: "draft" | "published";
  active: "create" | "results";
  saveState?: SaveState;
  onTitleSaved: (title: string) => void;
  /** right-side buttons (Preview / Publish ...) */
  actions?: React.ReactNode;
}

export function FormTopBar({ formId, title, status, active, saveState, onTitleSaved, actions }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState(title);

  useEffect(() => setDraft(title), [title]);

  const commit = async () => {
    const next = draft.trim();
    if (!next) {
      setDraft(title); // empty titles are not allowed - revert
      return;
    }
    if (next === title) return;
    try {
      await api.updateForm(formId, { title: next });
      onTitleSaved(next);
    } catch (e) {
      setDraft(title);
      toast.error(e instanceof Error ? e.message : "Could not rename form");
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/dashboard" className="icon-btn" aria-label="Back to workspace" title="Back to workspace">
          ←
        </Link>
        <input
          className="topbar-title"
          value={draft}
          maxLength={255}
          aria-label="Form title"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(title);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className={`pill pill-${status}`}>{status === "published" ? "Published" : "Draft"}</span>
      </div>

      <nav className="topbar-tabs">
        <Link href={`/forms/${formId}/edit`} className={`tab ${active === "create" ? "tab-active" : ""}`}>
          Create
        </Link>
        <Link href={`/forms/${formId}/results`} className={`tab ${active === "results" ? "tab-active" : ""}`}>
          Results
        </Link>
      </nav>

      <div className="topbar-right">
        {saveState && (
          <span className={`save-state save-${saveState}`}>
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "✓ Saved"}
          </span>
        )}
        {actions}
      </div>
    </header>
  );
}
