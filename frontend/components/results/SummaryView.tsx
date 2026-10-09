"use client";
import type { FormStats, QuestionStats } from "@/lib/types";
import { typeMeta } from "@/lib/questionTypes";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function QuestionCard({ q, index }: { q: QuestionStats; index: number }) {
  const meta = typeMeta(q.type);
  const max = Math.max(...(q.distribution?.map((d) => d.count) ?? [0]), 1);

  return (
    <section className="summary-card">
      <header className="summary-head">
        <span className="type-tile type-tile-sm" style={{ background: meta.color }}>{meta.icon}</span>
        <h3>{index + 1}. {q.title || "Untitled question"}</h3>
      </header>
      <div className="muted small">
        {q.answered} answered · {q.skipped} skipped
        {q.average != null && <> · average <strong>{q.average}</strong></>}
      </div>

      {q.distribution && (
        <div className="bars">
          {q.distribution.map((d) => (
            <div className="bar-row" key={d.label}>
              <span className="bar-label" title={d.label}>{d.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="bar-value">{d.count} <span className="muted">({d.percent}%)</span></span>
            </div>
          ))}
        </div>
      )}

      {q.samples && q.samples.length > 0 && (
        <ul className="samples">
          {q.samples.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {q.answered === 0 && <div className="muted small">No answers yet.</div>}
    </section>
  );
}

export function SummaryView({ stats }: { stats: FormStats }) {
  return (
    <div>
      <div className="stat-row">
        <Stat label="Total starts" value={stats.total_responses} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Completion rate" value={`${stats.completion_rate}%`} />
      </div>
      <div className="summary-grid">
        {stats.questions.map((q, i) => (
          <QuestionCard key={q.question_id} q={q} index={i} />
        ))}
      </div>
    </div>
  );
}
