"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormItem } from "@/components/dashboard/FormItem";
import { SUGGESTIONS, SuggestionCards } from "@/components/dashboard/SuggestionCards";
import { WorkspaceRail } from "@/components/dashboard/WorkspaceRail";
import { AppShell } from "@/components/shell/AppShell";
import { IconCalendar, IconChevronDown, IconDiamond, IconDots, IconGrid, IconList, IconUserPlus } from "@/components/ui/Icons";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { api, publicLink } from "@/lib/api";
import { readPref, writePref } from "@/lib/prefs";
import type { FormSummary, Usage, Workspace } from "@/lib/types";

type Sort = "created" | "updated" | "name";
const SORTS: { key: Sort; label: string }[] = [
  { key: "created", label: "Date created" },
  { key: "updated", label: "Last updated" },
  { key: "name", label: "Name" },
];

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function Dashboard() {
  const router = useRouter();
  const toast = useToast();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("created");
  const [view, setView] = useState<"list" | "grid">("list");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [sortOpen, setSortOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  const [renaming, setRenaming] = useState<FormSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<FormSummary | null>(null);
  const [wsModal, setWsModal] = useState<{ mode: "create" } | { mode: "rename"; ws: Workspace } | null>(null);
  const [wsName, setWsName] = useState("");
  const [wsDeleting, setWsDeleting] = useState<Workspace | null>(null);

  // Per-browser preferences are read after mount (localStorage doesn't exist during SSR).
  useEffect(() => {
    setView(readPref("view", "list"));
    setDismissed(readPref("dismissed", []));
    setSort(readPref("sort", "created"));
  }, []);

  // ---- data loading --------------------------------------------------------
  const loadMeta = useCallback(async () => {
    const [ws, u] = await Promise.all([api.listWorkspaces(), api.getUsage()]);
    setWorkspaces(ws);
    setUsage(u);
    setSelectedId((cur) => {
      const wanted = cur ?? readPref<number | null>("workspace", null);
      return ws.some((w) => w.id === wanted) ? wanted : ws[0]?.id ?? null;
    });
  }, []);

  const loadForms = useCallback(async (wsId: number) => {
    setForms(await api.listForms(wsId));
  }, []);

  useEffect(() => {
    loadMeta().catch((e) => setError(errMsg(e, "Failed to load workspaces")));
  }, [loadMeta]);

  useEffect(() => {
    if (selectedId == null) return;
    setForms(null);
    loadForms(selectedId).catch((e) => setError(errMsg(e, "Failed to load forms")));
  }, [selectedId, loadForms]);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadMeta(), selectedId != null ? loadForms(selectedId) : Promise.resolve()]);
      setError(null);
    } catch (e) {
      setError(errMsg(e, "Failed to refresh"));
    }
  }, [loadMeta, loadForms, selectedId]);

  // close popovers on outside click
  useEffect(() => {
    if (!sortOpen && !wsMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
      if (!wsMenuRef.current?.contains(e.target as Node)) setWsMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [sortOpen, wsMenuOpen]);

  // ---- derived ---------------------------------------------------------------
  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (forms ?? []).filter((f) => f.title.toLowerCase().includes(q));
    const by = {
      created: (a: FormSummary, b: FormSummary) => +new Date(b.created_at) - +new Date(a.created_at),
      updated: (a: FormSummary, b: FormSummary) => +new Date(b.updated_at) - +new Date(a.updated_at),
      name: (a: FormSummary, b: FormSummary) => a.title.localeCompare(b.title),
    }[sort];
    return [...rows].sort(by);
  }, [forms, query, sort]);

  const suggestions = SUGGESTIONS.filter((s) => !dismissed.includes(s.id));

  // ---- actions ----------------------------------------------------------------
  const selectWorkspace = (id: number) => {
    setSelectedId(id);
    writePref("workspace", id);
    setQuery("");
  };

  const createForm = async (template?: string) => {
    setCreating(true);
    try {
      const f = await api.createForm({ workspaceId: selectedId ?? undefined, template });
      router.push(`/forms/${f.id}/edit`);
    } catch (e) {
      toast.error(errMsg(e, "Could not create form"));
      setCreating(false);
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    const title = renameValue.trim();
    if (!title) return toast.error("Title can't be empty");
    try {
      await api.updateForm(renaming.id, { title });
      toast.success("Form renamed");
      setRenaming(null);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Rename failed"));
    }
  };

  const duplicate = async (f: FormSummary) => {
    try {
      await api.duplicateForm(f.id);
      toast.success("Form duplicated");
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Duplicate failed"));
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteForm(deleting.id);
      toast.success("Form deleted");
      setDeleting(null);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Delete failed"));
    }
  };

  const togglePublish = async (f: FormSummary) => {
    try {
      if (f.status === "published") {
        await api.unpublish(f.id);
        toast.info("Form unpublished - its link no longer works");
      } else {
        await api.publish(f.id);
        toast.success("Form published");
      }
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not change status"));
    }
  };

  const copyLink = async (f: FormSummary) => {
    try {
      await navigator.clipboard.writeText(publicLink(f.slug));
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const moveForm = async (f: FormSummary, workspaceId: number) => {
    try {
      await api.moveForm(f.id, workspaceId);
      const name = workspaces.find((w) => w.id === workspaceId)?.name;
      toast.success(`Moved to ${name}`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not move form"));
    }
  };

  const saveWorkspace = async () => {
    const name = wsName.trim();
    if (!name || !wsModal) return toast.error("Name can't be empty");
    try {
      if (wsModal.mode === "create") {
        const w = await api.createWorkspace(name);
        selectWorkspace(w.id);
        toast.success("Workspace created");
      } else {
        await api.renameWorkspace(wsModal.ws.id, name);
        toast.success("Workspace renamed");
      }
      setWsModal(null);
      loadMeta();
    } catch (e) {
      toast.error(errMsg(e, "Could not save workspace"));
    }
  };

  const doDeleteWorkspace = async () => {
    if (!wsDeleting) return;
    try {
      await api.deleteWorkspace(wsDeleting.id);
      toast.success("Workspace deleted");
      if (wsDeleting.id === selectedId) setSelectedId(null); // loadMeta picks the first remaining one
      setWsDeleting(null);
      loadMeta();
    } catch (e) {
      toast.error(errMsg(e, "Could not delete workspace"));
    }
  };

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writePref("dismissed", next);
  };

  const pickView = (v: "list" | "grid") => {
    setView(v);
    writePref("view", v);
  };

  const pickSort = (s: Sort) => {
    setSort(s);
    writePref("sort", s);
    setSortOpen(false);
  };

  const soon = (what: string) => toast.info(`${what} is coming soon`);

  return (
    <AppShell active="forms">
      <WorkspaceRail
        workspaces={workspaces}
        selectedId={selectedId}
        usage={usage}
        query={query}
        creating={creating}
        onQuery={setQuery}
        onSelect={selectWorkspace}
        onCreateForm={() => createForm()}
        onAddWorkspace={() => { setWsName(""); setWsModal({ mode: "create" }); }}
        onRenameWorkspace={(w) => { setWsName(w.name); setWsModal({ mode: "rename", ws: w }); }}
        onDeleteWorkspace={setWsDeleting}
        onIncreaseLimit={() => soon("Plans & billing")}
      />

      <section className="content">
        <div className="content-head">
          <div className="content-title">
            <h1>{selected?.name ?? "My workspace"}</h1>
            <div className="menu-wrap" ref={wsMenuRef}>
              <button className="icon-btn" aria-label="Workspace options" onClick={() => setWsMenuOpen((o) => !o)}>
                <IconDots size={18} />
              </button>
              {wsMenuOpen && selected && (
                <div className="menu" role="menu">
                  <button className="menu-item" onClick={() => { setWsMenuOpen(false); setWsName(selected.name); setWsModal({ mode: "rename", ws: selected }); }}>
                    Rename workspace
                  </button>
                  <button
                    className="menu-item menu-danger"
                    disabled={workspaces.length <= 1}
                    onClick={() => { setWsMenuOpen(false); setWsDeleting(selected); }}
                  >
                    Delete workspace
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-sm invite" onClick={() => soon("Inviting teammates")}>
              <IconUserPlus size={18} /> Invite
            </button>
            <span className="tf-gem"><IconDiamond size={13} /></span>
          </div>

          <div className="content-controls">
            <div className="menu-wrap" ref={sortRef}>
              <button className="sort-btn" onClick={() => setSortOpen((o) => !o)} aria-haspopup="menu" aria-expanded={sortOpen}>
                <IconCalendar size={17} /> {SORTS.find((s) => s.key === sort)?.label} <IconChevronDown size={15} />
              </button>
              {sortOpen && (
                <div className="menu menu-left" role="menu">
                  {SORTS.map((s) => (
                    <button key={s.key} className={`menu-item ${s.key === sort ? "menu-item-on" : ""}`} onClick={() => pickSort(s.key)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="view-toggle" role="group" aria-label="View">
              <button className={view === "list" ? "vt-on" : ""} onClick={() => pickView("list")} aria-pressed={view === "list"}>
                <IconList size={17} /> List
              </button>
              <button className={view === "grid" ? "vt-on" : ""} onClick={() => pickView("grid")} aria-pressed={view === "grid"}>
                <IconGrid size={17} /> Grid
              </button>
            </div>
          </div>
        </div>

        <div className="content-scroll">
          <SuggestionCards items={suggestions} busy={creating} onCreate={createForm} onDismiss={dismiss} />

          {error && (
            <div className="empty">
              <p>{error}</p>
              <button className="btn btn-outline" onClick={refresh}>Retry</button>
            </div>
          )}

          {!error && !forms && <div className="skeleton-list">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>}

          {!error && forms && visible.length === 0 && (
            <div className="empty">
              <h3>{query ? "No forms match your search" : "No forms in this workspace yet"}</h3>
              {!query && (
                <button className="btn btn-primary" onClick={() => createForm()} disabled={creating}>Create form</button>
              )}
            </div>
          )}

          {!error && forms && visible.length > 0 && view === "list" && (
            <div className="form-table">
              <div className="form-table-head">
                <span />
                <span>Responses</span>
                <span>Completed</span>
                <span>Updated</span>
                <span>Integrations</span>
                <span />
              </div>
              {visible.map((f) => (
                <FormItem key={f.id} form={f} view="list" workspaces={workspaces} onRename={(x) => { setRenaming(x); setRenameValue(x.title); }}
                  onDuplicate={duplicate} onDelete={setDeleting} onCopyLink={copyLink} onTogglePublish={togglePublish}
                  onMove={moveForm} onIntegrations={() => soon("Integrations")} />
              ))}
            </div>
          )}

          {!error && forms && visible.length > 0 && view === "grid" && (
            <div className="form-grid">
              {visible.map((f) => (
                <FormItem key={f.id} form={f} view="grid" workspaces={workspaces} onRename={(x) => { setRenaming(x); setRenameValue(x.title); }}
                  onDuplicate={duplicate} onDelete={setDeleting} onCopyLink={copyLink} onTogglePublish={togglePublish}
                  onMove={moveForm} onIntegrations={() => soon("Integrations")} />
              ))}
            </div>
          )}
        </div>
      </section>

      {renaming && (
        <Modal
          title="Rename form"
          onClose={() => setRenaming(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRename}>Save</button>
            </>
          }
        >
          <input
            className="text-input"
            value={renameValue}
            autoFocus
            maxLength={255}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doRename()}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this form?"
          message={`"${deleting.title}" and all ${deleting.response_count} of its responses will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {wsModal && (
        <Modal
          title={wsModal.mode === "create" ? "New workspace" : "Rename workspace"}
          onClose={() => setWsModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setWsModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveWorkspace}>{wsModal.mode === "create" ? "Create" : "Save"}</button>
            </>
          }
        >
          <input
            className="text-input"
            placeholder="Workspace name"
            value={wsName}
            autoFocus
            maxLength={120}
            onChange={(e) => setWsName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveWorkspace()}
          />
        </Modal>
      )}

      {wsDeleting && (
        <ConfirmModal
          title="Delete this workspace?"
          message={`"${wsDeleting.name}" and its ${wsDeleting.form_count} form${wsDeleting.form_count === 1 ? "" : "s"} (with all responses) will be permanently deleted.`}
          confirmLabel="Delete workspace"
          danger
          onConfirm={doDeleteWorkspace}
          onClose={() => setWsDeleting(null)}
        />
      )}
    </AppShell>
  );
}
