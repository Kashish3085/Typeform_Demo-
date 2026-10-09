"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormRunner } from "@/components/respondent/FormRunner";
import { api } from "@/lib/api";
import type { PublicForm } from "@/lib/types";

/** Public, no-auth page: /f/<slug>. Full-screen conversational form. */
export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicForm(slug)
      .then((f) => !cancelled && (setForm(f), setState("ready")))
      .catch((e) => !cancelled && setState(e?.status === 404 ? "unavailable" : "error"));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (form) document.title = form.title;
  }, [form]);

  if (state === "loading") return <div className="fullscreen-msg"><div className="spinner" /></div>;
  if (state === "unavailable")
    return (
      <div className="fullscreen-msg">
        <h1>This form is unavailable</h1>
        <p className="muted">It may have been unpublished or the link is incorrect.</p>
      </div>
    );
  if (state === "error" || !form)
    return (
      <div className="fullscreen-msg">
        <h1>Something went wrong</h1>
        <p className="muted">We couldn&apos;t load this form. Please refresh and try again.</p>
      </div>
    );

  return (
    <div className="public-shell" style={{ background: form.theme_background }}>
      <FormRunner form={form} onSubmit={(answers) => api.submitResponse(slug, answers)} />
      <a className="powered" href="/" target="_blank" rel="noreferrer">
        Made with <strong>Typeform clone</strong>
      </a>
    </div>
  );
}
