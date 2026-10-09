"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormTopBar } from "@/components/FormTopBar";
import { ResponseDrawer } from "@/components/results/ResponseDrawer";
import { ResponsesTable } from "@/components/results/ResponsesTable";
import { SummaryView } from "@/components/results/SummaryView";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import type { Form, FormStats, ResponseListItem } from "@/lib/types";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const formId = Number(id);
  const toast = useToast();

  const [form, setForm] = useState<Form | null>(null);
  const [rows, setRows] = useState<ResponseListItem[]>([]);
  const [stats, setStats] = useState<FormStats | null>(null);
  const [view, setView] = useState<"summary" | "responses">("summary");
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, r, s] = await Promise.all([api.getForm(formId), api.listResponses(formId), api.getStats(formId)]);
      setForm(f);
      setRows(r);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    try {
      const blob = await api.exportCsv(formId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `form-${formId}-responses.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (error) return <div className="fullscreen-msg"><h1>{error}</h1></div>;
  if (!form || !stats) return <div className="fullscreen-msg"><div className="spinner" /></div>;

  return (
    <div className="results">
      <FormTopBar
        formId={form.id}
        title={form.title}
        status={form.status}
        active="results"
        onTitleSaved={(title) => setForm({ ...form, title })}
        actions={
          <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
        }
      />

      <main className="results-main">
        <div className="seg">
          <button className={`seg-btn ${view === "summary" ? "seg-active" : ""}`} onClick={() => setView("summary")}>
            Summary
          </button>
          <button className={`seg-btn ${view === "responses" ? "seg-active" : ""}`} onClick={() => setView("responses")}>
            Responses <span className="badge">{rows.length}</span>
          </button>
        </div>

        {view === "summary" ? (
          stats.completed === 0 ? (
            <div className="empty">
              <h3>No responses yet</h3>
              <p className="muted">{form.status === "published" ? "Share your link to start collecting." : "Publish your form to start collecting responses."}</p>
            </div>
          ) : (
            <SummaryView stats={stats} />
          )
        ) : (
          <ResponsesTable questions={form.questions} rows={rows} onOpen={setOpenId} />
        )}
      </main>

      {openId !== null && (
        <ResponseDrawer
          formId={form.id}
          responseId={openId}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
