"use client";
/**
 * "Typeform AI" side panel.
 *
 * MOCK: there is no language model behind this. It is a small rule-based assistant:
 * it matches keywords in what you type ("quiz", "feedback", "contact", "event") and creates
 * a real form from the matching starter template (backend/app/templates.py). Anything else
 * gets a canned reply listing what it can do.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconCollapse, IconDots, IconMic, IconPlus, IconSend, IconSparkle } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import { readPref } from "@/lib/prefs";

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
  chips?: { label: string; template: string }[];
}

const CHIPS = [
  { label: "Collect audience feedback", template: "feedback" },
  { label: "Build a fun facts quiz", template: "quiz" },
  { label: "Create a contact form", template: "contact" },
  { label: "Set up event registration", template: "registration" },
];

const RULES: [RegExp, string][] = [
  [/feedback|survey|review|rating|opinion/i, "feedback"],
  [/quiz|trivia|knowledge|test/i, "quiz"],
  [/contact|support|inquiry|enquiry|help desk/i, "contact"],
  [/event|regist|rsvp|sign.?up|meetup/i, "registration"],
];

export function AiPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const push = (m: Omit<Msg, "id">) => setMsgs((x) => [...x, { ...m, id: nextId.current++ }]);

  const build = async (template: string, label: string) => {
    if (busy) return;
    setBusy(true);
    push({ role: "ai", text: `Great - setting up "${label}" for you…` });
    try {
      const ws = readPref<number | null>("workspace", null) ?? undefined;
      let form;
      try {
        form = await api.createForm({ template, workspaceId: ws });
      } catch {
        form = await api.createForm({ template }); // stored workspace may have been deleted
      }
      router.push(`/forms/${form.id}/edit`);
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not create the form");
    }
  };

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    push({ role: "user", text: t });
    setText("");
    const hit = RULES.find(([re]) => re.test(t));
    if (hit) {
      const chip = CHIPS.find((c) => c.template === hit[1])!;
      void build(chip.template, chip.label);
    } else {
      push({
        role: "ai",
        text: "I can build a form from a template. Try “create a quiz”, “collect feedback”, “contact form” or “event registration” - or pick one:",
        chips: CHIPS,
      });
    }
  };

  const start = () =>
    push({ role: "ai", text: "Happy to help! What would you like to create?", chips: CHIPS });

  return (
    <aside className="ai-panel" aria-label="Typeform AI">
      <header className="ai-head">
        <span className="ai-title">
          <IconSparkle size={18} /> Typeform AI <span className="beta">Beta</span>
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Collapse Typeform AI" title="Collapse">
          <IconCollapse size={16} />
        </button>
      </header>

      <div className="ai-body">
        {msgs.length === 0 ? (
          <div className="ai-empty">
            <div className="ai-spark"><IconSparkle size={30} /></div>
            <h2>What do you want to achieve?</h2>
            <p>Tell Typeform AI your business goal. It can help you build forms, manage contacts, and create automations to get you there.</p>
            <button className="btn btn-outline btn-pill" onClick={start}>Help me get started</button>
          </div>
        ) : (
          <div className="ai-thread">
            {msgs.map((m) => (
              <div key={m.id} className={`ai-msg ai-${m.role}`}>
                <div className="ai-bubble">{m.text}</div>
                {m.chips && (
                  <div className="ai-chips">
                    {m.chips.map((c) => (
                      <button key={c.template} className="ai-chip" disabled={busy} onClick={() => build(c.template, c.label)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="ai-input">
        <textarea
          rows={1}
          placeholder="Ask Typeform AI"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          aria-label="Ask Typeform AI"
        />
        <div className="ai-input-row">
          <span className="ai-tools">
            <button className="icon-btn" disabled title="Voice input isn't available" aria-label="Voice input"><IconMic size={16} /></button>
            <button className="icon-btn" disabled title="Attachments aren't available" aria-label="Attach"><IconPlus size={16} /></button>
            <button className="icon-btn" disabled aria-label="More"><IconDots size={16} /></button>
          </span>
          <button className="ai-send" onClick={() => send(text)} disabled={!text.trim() || busy} aria-label="Send">
            <IconSend size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
