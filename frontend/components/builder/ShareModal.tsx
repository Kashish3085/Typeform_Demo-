"use client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { publicLink } from "@/lib/api";
import type { Form } from "@/lib/types";

interface Props {
  form: Form;
  onClose: () => void;
  onUnpublish: () => void;
}

export function ShareModal({ form, onClose, onUnpublish }: Props) {
  const toast = useToast();
  const link = publicLink(form.slug);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy - select the link and copy it manually");
    }
  };

  return (
    <Modal
      title="Your form is live 🎉"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onUnpublish}>Unpublish</button>
          <a className="btn btn-outline" href={link} target="_blank" rel="noreferrer">Open form</a>
          <button className="btn btn-primary" onClick={copy}>Copy link</button>
        </>
      }
    >
      <p className="muted">Anyone with this link can fill it in - no account needed.</p>
      <div className="link-box">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Shareable link" />
      </div>
    </Modal>
  );
}
