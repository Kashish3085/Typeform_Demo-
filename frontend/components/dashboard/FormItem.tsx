"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconDots, IconIntegrations } from "@/components/ui/Icons";
import type { FormSummary, Workspace } from "@/lib/types";

interface Props {
  form: FormSummary;
  view: "list" | "grid";
  workspaces: Workspace[];
  onRename: (f: FormSummary) => void;
  onDuplicate: (f: FormSummary) => void;
  onDelete: (f: FormSummary) => void;
  onCopyLink: (f: FormSummary) => void;
  onTogglePublish: (f: FormSummary) => void;
  onMove: (f: FormSummary, workspaceId: number) => void;
  onIntegrations: () => void;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

function Thumb() {
  return (
    <span className="form-thumb" aria-hidden>
      <i /><i />
    </span>
  );
}

/** One form, as a table row (list view) or a card (grid view), with its actions menu. */
export function FormItem({ form, view, workspaces, ...cb }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const others = workspaces.filter((w) => w.id !== form.workspace_id);

  const menu = (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" aria-label={`${form.title} actions`} onClick={() => setOpen((o) => !o)}>
        <IconDots size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <Link href={`/forms/${form.id}/edit`} className="menu-item">Edit</Link>
          <Link href={`/forms/${form.id}/results`} className="menu-item">View results</Link>
          <button className="menu-item" onClick={act(() => cb.onRename(form))}>Rename</button>
          <button className="menu-item" onClick={act(() => cb.onDuplicate(form))}>Duplicate</button>
          {form.status === "published" && (
            <button className="menu-item" onClick={act(() => cb.onCopyLink(form))}>Copy link</button>
          )}
          <button className="menu-item" onClick={act(() => cb.onTogglePublish(form))}>
            {form.status === "published" ? "Unpublish" : "Publish"}
          </button>
          {others.length > 0 && (
            <>
              <div className="menu-sep" />
              <div className="menu-label">Move to</div>
              {others.map((w) => (
                <button key={w.id} className="menu-item" onClick={act(() => cb.onMove(form, w.id))}>{w.name}</button>
              ))}
            </>
          )}
          <div className="menu-sep" />
          <button className="menu-item menu-danger" onClick={act(() => cb.onDelete(form))}>Delete</button>
        </div>
      )}
    </div>
  );

  const status = (
    <span className={`pill pill-${form.status}`}>{form.status === "published" ? "Published" : "Draft"}</span>
  );

  if (view === "grid") {
    return (
      <div className="form-card">
        <Link href={`/forms/${form.id}/edit`} className="form-card-top" aria-label={`Edit ${form.title}`}>
          <Thumb />
        </Link>
        <div className="form-card-bottom">
          <div className="form-card-info">
            <div className="form-name" title={form.title}>{form.title}</div>
            <div className="muted small">
              {form.response_count} response{form.response_count === 1 ? "" : "s"} · {formatDate(form.updated_at)}
            </div>
          </div>
          {menu}
        </div>
        <div className="form-card-status">{status}</div>
      </div>
    );
  }

  return (
    <div className="form-row">
      <Link href={`/forms/${form.id}/edit`} className="form-row-main">
        <Thumb />
        <span className="form-name" title={form.title}>{form.title}</span>
        {status}
      </Link>
      <Link href={`/forms/${form.id}/results`} className="cell-center" title="View responses">
        {form.response_count || "-"}
      </Link>
      <span className="cell-center">{form.completion_rate == null ? "-" : `${form.completion_rate}%`}</span>
      <span className="cell-center">{formatDate(form.updated_at)}</span>
      <span className="cell-center">
        <button className="int-btn" onClick={cb.onIntegrations} aria-label="Integrations" title="Integrations (coming soon)">
          <IconIntegrations size={16} />
        </button>
      </span>
      {menu}
    </div>
  );
}
