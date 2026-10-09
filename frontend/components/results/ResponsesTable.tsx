"use client";
import type { BuilderQuestion, ResponseListItem } from "@/lib/types";

interface Props {
  questions: BuilderQuestion[];
  rows: ResponseListItem[];
  onOpen: (id: number) => void;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

export function ResponsesTable({ questions, rows, onOpen }: Props) {
  if (rows.length === 0)
    return (
      <div className="empty">
        <h3>No responses yet</h3>
        <p className="muted">Share your form link to start collecting responses.</p>
      </div>
    );

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Submitted</th>
            {questions.map((q) => (
              <th key={q.id} title={q.title}>{q.title || "Untitled"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(r.id)}>
              <td className="muted">{r.id}</td>
              <td>{fmt(r.submitted_at)}</td>
              {questions.map((q) => (
                <td key={q.id} className="cell">{r.answers[String(q.id)] || <span className="muted">-</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
