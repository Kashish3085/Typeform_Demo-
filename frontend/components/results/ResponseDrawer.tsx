"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import type { ResponseDetail } from "@/lib/types";

interface Props {
  formId: number;
  responseId: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function ResponseDrawer({ formId, responseId, onClose, onDeleted }: Props) {
  const toast = useToast();
  const [data, setData] = useState<ResponseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api.getResponse(formId, responseId).then(setData).catch((e) => setError(e.message));
  }, [formId, responseId]);

  const remove = async () => {
    if (!confirm("Delete this response permanently?")) return;
    try {
      await api.deleteResponse(formId, responseId);
      toast.success("Response deleted");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  return (
    <Modal
      title={`Response #${responseId}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-ghost" onClick={remove}>Delete</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      {error && <p className="muted">{error}</p>}
      {!data && !error && <div className="spinner" />}
      {data && (
        <>
          <p className="muted small">
            Submitted {data.submitted_at ? new Date(data.submitted_at).toLocaleString() : "(not completed)"}
          </p>
          <dl className="detail-list">
            {data.answers.map((a, i) => (
              <div key={a.question_id} className="detail-item">
                <dt>{i + 1}. {a.question_title || "Untitled question"}</dt>
                <dd>{a.display || <span className="muted">No answer</span>}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Modal>
  );
}
