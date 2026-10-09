"use client";
import { useEffect, useRef } from "react";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import type { QuestionType } from "@/lib/types";

interface Props {
  onPick: (t: QuestionType) => void;
  onClose: () => void;
}

export function AddQuestionMenu({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return (
    <div className="add-menu" ref={ref} role="menu">
      <div className="add-menu-title">Add a question</div>
      <div className="add-menu-grid">
        {QUESTION_TYPES.map((t) => (
          <button key={t.type} className="add-menu-item" role="menuitem" onClick={() => onPick(t.type)}>
            <span className="type-tile" style={{ background: t.color }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
