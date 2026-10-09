"use client";
import { useEffect, useRef, useState } from "react";
import { IconCaretUp, IconDots, IconPlus, IconSearch } from "@/components/ui/Icons";
import type { Usage, Workspace } from "@/lib/types";

interface Props {
  workspaces: Workspace[];
  selectedId: number | null;
  usage: Usage | null;
  query: string;
  creating: boolean;
  onQuery: (q: string) => void;
  onSelect: (id: number) => void;
  onCreateForm: () => void;
  onAddWorkspace: () => void;
  onRenameWorkspace: (w: Workspace) => void;
  onDeleteWorkspace: (w: Workspace) => void;
  onIncreaseLimit: () => void;
}

/** Left rail of the dashboard: Create form, search, workspaces, plan usage. */
export function WorkspaceRail(p: Props) {
  const [open, setOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuFor === null) return;
    const h = (e: MouseEvent) => !listRef.current?.contains(e.target as Node) && setMenuFor(null);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuFor]);

  const pct = p.usage ? Math.min(100, Math.round((p.usage.responses_collected / p.usage.limit) * 100)) : 0;

  return (
    <aside className="rail">
      <div className="rail-section">
        <button className="create-btn" onClick={p.onCreateForm} disabled={p.creating}>
          <IconPlus size={18} /> Create form
        </button>
      </div>

      <label className="rail-section rail-search">
        <IconSearch size={18} />
        <input placeholder="Search" value={p.query} onChange={(e) => p.onQuery(e.target.value)} aria-label="Search forms" />
      </label>

      <div className="rail-section rail-grow">
        <div className="rail-row-head">
          <span className="rail-heading">
            <IconWorkspaceGlyph /> Workspaces
          </span>
          <button className="rail-add" onClick={p.onAddWorkspace} aria-label="New workspace" title="New workspace">
            <IconPlus size={16} />
          </button>
        </div>

        <button className="rail-group" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Private
          <span className={`rail-caret ${open ? "" : "rail-caret-closed"}`}><IconCaretUp size={14} /></span>
        </button>

        {open && (
          <div className="rail-list" ref={listRef}>
            {p.workspaces.map((w) => (
              <div key={w.id} className={`rail-item ${w.id === p.selectedId ? "rail-item-active" : ""}`}>
                <button
                  className="rail-item-main"
                  onClick={() => {
                    setMenuFor(null);
                    p.onSelect(w.id);
                  }}
                >
                  <span className="rail-item-name">{w.name}</span>
                  <span className="rail-count">{w.form_count}</span>
                </button>
                <button
                  className="rail-item-kebab icon-btn"
                  aria-label={`${w.name} options`}
                  onClick={() => setMenuFor(menuFor === w.id ? null : w.id)}
                >
                  <IconDots size={16} />
                </button>
                {menuFor === w.id && (
                  <div className="menu rail-menu" role="menu">
                    <button className="menu-item" onClick={() => { setMenuFor(null); p.onRenameWorkspace(w); }}>Rename</button>
                    <button
                      className="menu-item menu-danger"
                      disabled={p.workspaces.length <= 1}
                      title={p.workspaces.length <= 1 ? "You can't delete your only workspace" : undefined}
                      onClick={() => { setMenuFor(null); p.onDeleteWorkspace(w); }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rail-section rail-usage">
        <div className="rail-usage-title">Responses collected</div>
        <div className="usage-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="usage-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="usage-num">
          <strong>{p.usage?.responses_collected ?? 0}</strong> <span className="muted small">/ {p.usage?.limit ?? "-"}</span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={p.onIncreaseLimit}>Increase response limit</button>
      </div>
    </aside>
  );
}

function IconWorkspaceGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}
