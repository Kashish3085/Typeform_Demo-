"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormTopBar, type SaveState } from "@/components/FormTopBar";
import { FormSettingsPanel } from "@/components/builder/FormSettingsPanel";
import { QuestionCanvas } from "@/components/builder/QuestionCanvas";
import { QuestionSettings } from "@/components/builder/QuestionSettings";
import { QuestionSidebar } from "@/components/builder/QuestionSidebar";
import { ShareModal } from "@/components/builder/ShareModal";
import { FormRunner } from "@/components/respondent/FormRunner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import type { BuilderQuestion, Form, QuestionType } from "@/lib/types";

type Tab = "question" | "form" | "preview";
const SAVE_DELAY = 600;

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const formId = Number(id);
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("question");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sharing, setSharing] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ---- debounced autosave -------------------------------------------------
  // Edits update local state instantly (optimistic) and are PATCHed after the
  // user pauses typing. We keep one timer + one merged patch per target so rapid
  // keystrokes produce a single request.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, { run: () => Promise<unknown>; }>>(new Map());
  const inFlight = useRef(0);
  const failed = useRef(false);

  const refreshSaveState = () => setSaveState(failed.current ? "error" : inFlight.current > 0 || pending.current.size > 0 ? "saving" : "saved");

  const execute = useCallback(async (key: string) => {
    const job = pending.current.get(key);
    if (!job) return;
    pending.current.delete(key);
    timers.current.delete(key);
    inFlight.current++;
    try {
      await job.run();
      failed.current = false;
    } catch (e) {
      failed.current = true;
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      inFlight.current--;
      refreshSaveState();
    }
  }, [toast]);

  const schedule = useCallback((key: string, run: () => Promise<unknown>) => {
    pending.current.set(key, { run });
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(() => void execute(key), SAVE_DELAY));
    setSaveState("saving");
  }, [execute]);

  const flushAll = useCallback(async () => {
    const keys = [...pending.current.keys()];
    keys.forEach((k) => clearTimeout(timers.current.get(k)));
    await Promise.all(keys.map(execute));
  }, [execute]);

  // Warn about unsaved edits when the tab is closed.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // ---- load ----------------------------------------------------------------
  useEffect(() => {
    api.getForm(formId)
      .then((f) => {
        setForm(f);
        setSelectedId(f.questions[0]?.id ?? null);
      })
      .catch((e) => setLoadError(e?.status === 404 ? "Form not found" : e?.message ?? "Failed to load"));
  }, [formId]);

  const questions = form?.questions ?? [];
  const selectedIndex = questions.findIndex((q) => q.id === selectedId);
  const selected = selectedIndex >= 0 ? questions[selectedIndex] : null;

  // ---- question actions ----------------------------------------------------
  const patchQuestion = (qid: number, patch: Partial<BuilderQuestion>) => {
    setForm((f) => f && { ...f, questions: f.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) });
    // Merge successive patches for the same question into the latest full state.
    schedule(`q:${qid}`, () => {
      const q = formRef.current?.questions.find((x) => x.id === qid);
      if (!q) return Promise.resolve();
      return api.updateQuestion(qid, {
        title: q.title, description: q.description, required: q.required, properties: q.properties,
      });
    });
  };

  // formRef gives deferred save jobs the latest state instead of a stale closure.
  const formRef = useRef<Form | null>(null);
  formRef.current = form;

  const changeType = async (qid: number, type: QuestionType) => {
    await flushAll();
    try {
      const updated = await api.updateQuestion(qid, { type });
      setForm((f) => f && { ...f, questions: f.questions.map((q) => (q.id === qid ? updated : q)) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change type");
    }
  };

  const addQuestion = async (type: QuestionType) => {
    if (!form) return;
    await flushAll();
    try {
      const at = selectedIndex >= 0 ? selectedIndex + 1 : questions.length;
      const created = await api.addQuestion(form.id, type, at);
      // Server renumbers positions, so refetch the ordered list rather than guessing.
      const fresh = await api.getForm(form.id);
      setForm(fresh);
      setSelectedId(created.id);
      setTab("question");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add question");
    }
  };

  const deleteQuestion = async (q: BuilderQuestion) => {
    if (!form) return;
    clearTimeout(timers.current.get(`q:${q.id}`));
    pending.current.delete(`q:${q.id}`); // no point saving a question we're deleting
    const idx = questions.findIndex((x) => x.id === q.id);
    try {
      await api.deleteQuestion(q.id);
      const rest = questions.filter((x) => x.id !== q.id);
      setForm({ ...form, questions: rest.map((x, i) => ({ ...x, position: i })) });
      if (selectedId === q.id) setSelectedId(rest[Math.min(idx, rest.length - 1)]?.id ?? null);
      toast.success("Question deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete question");
    }
  };

  const reorder = async (orderedIds: number[]) => {
    if (!form) return;
    const before = form;
    const byId = new Map(form.questions.map((q) => [q.id, q]));
    // optimistic: reflect the new order immediately
    setForm({ ...form, questions: orderedIds.map((qid, i) => ({ ...byId.get(qid)!, position: i })) });
    try {
      await flushAll();
      await api.reorderQuestions(form.id, orderedIds);
    } catch (e) {
      setForm(before); // roll back
      toast.error(e instanceof Error ? e.message : "Could not reorder");
    }
  };

  // ---- form-level settings -------------------------------------------------
  const patchForm = (patch: Partial<Form>) => {
    setForm((f) => f && { ...f, ...patch });
    schedule("form", () => {
      const f = formRef.current;
      if (!f) return Promise.resolve();
      return api.updateForm(f.id, {
        welcome_title: f.welcome_title, welcome_description: f.welcome_description,
        welcome_button: f.welcome_button, thank_you_title: f.thank_you_title,
        thank_you_message: f.thank_you_message, theme_background: f.theme_background,
        theme_question_color: f.theme_question_color, theme_button_color: f.theme_button_color,
        theme_font: f.theme_font,
      });
    });
  };

  // ---- publish -------------------------------------------------------------
  const publish = async () => {
    if (!form) return;
    setPublishing(true);
    try {
      await flushAll(); // make sure the server has the latest titles before validating them
      const updated = await api.publish(form.id);
      setForm((f) => f && { ...f, status: updated.status, published_at: updated.published_at });
      setSharing(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    if (!form) return;
    try {
      await api.unpublish(form.id);
      setForm({ ...form, status: "draft" });
      setSharing(false);
      toast.info("Form unpublished - its link no longer works");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unpublish");
    }
  };

  // Keep the preview from remounting on every keystroke.
  const runnerForm = useMemo(() => form && { ...form }, [form]);

  if (loadError)
    return (
      <div className="fullscreen-msg">
        <h1>{loadError}</h1>
        <button className="btn btn-primary" onClick={() => router.push("/dashboard")}>Back to workspace</button>
      </div>
    );
  if (!form || !runnerForm) return <div className="fullscreen-msg"><div className="spinner" /></div>;

  return (
    <div className="builder">
      <FormTopBar
        formId={form.id}
        title={form.title}
        status={form.status}
        active="create"
        saveState={saveState}
        onTitleSaved={(title) => setForm((f) => f && { ...f, title })}
        actions={
          <>
            <button className="btn btn-outline" onClick={() => setFullPreview(true)} disabled={questions.length === 0}>
              Preview
            </button>
            {form.status === "published" ? (
              <button className="btn btn-primary" onClick={() => setSharing(true)}>Share</button>
            ) : (
              <button className="btn btn-primary" onClick={publish} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish"}
              </button>
            )}
          </>
        }
      />

      <div className="builder-body">
        <QuestionSidebar
          questions={questions}
          selectedId={selectedId}
          onSelect={(qid) => { setSelectedId(qid); setTab((t) => (t === "form" ? "question" : t)); }}
          onReorder={reorder}
          onAdd={addQuestion}
          onDelete={deleteQuestion}
        />

        <main className="builder-center">
          {selected ? (
            <QuestionCanvas
              key={selected.id}
              question={selected}
              index={selectedIndex}
              onChange={(patch) => patchQuestion(selected.id, patch)}
            />
          ) : (
            <div className="empty">
              <h3>Add your first question</h3>
              <p className="muted">Use “Add question” on the left to get started.</p>
            </div>
          )}
        </main>

        <aside className="panel">
          <div className="panel-tabs">
            {(["question", "form", "preview"] as Tab[]).map((t) => (
              <button key={t} className={`panel-tab ${tab === t ? "panel-tab-active" : ""}`} onClick={() => setTab(t)}>
                {t === "question" ? "Question" : t === "form" ? "Form" : "Preview"}
              </button>
            ))}
          </div>

          {tab === "question" && selected && (
            <QuestionSettings
              key={selected.id}
              question={selected}
              onChange={(patch) => patchQuestion(selected.id, patch)}
              onChangeType={(t) => changeType(selected.id, t)}
            />
          )}
          {tab === "question" && !selected && <div className="panel-section muted">Select a question to edit its settings.</div>}
          {tab === "form" && <FormSettingsPanel form={form} onChange={patchForm} />}
          {tab === "preview" && (
            <div className="panel-section">
              <div className="preview-frame">
                {questions.length > 0 ? (
                  <FormRunner form={runnerForm} startAt={Math.max(selectedIndex, 0)} keyboard={false} preview />
                ) : (
                  <div className="empty">Add a question to see a preview.</div>
                )}
              </div>
              <p className="muted small">Follows the question you&apos;ve selected. Use Preview in the top bar to try the full flow.</p>
            </div>
          )}
        </aside>
      </div>

      {sharing && <ShareModal form={form} onClose={() => setSharing(false)} onUnpublish={unpublish} />}

      {fullPreview && (
        <Modal title="Preview" wide onClose={() => setFullPreview(false)}>
          <div className="preview-full">
            <FormRunner form={runnerForm} preview />
          </div>
        </Modal>
      )}
    </div>
  );
}
