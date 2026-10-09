"use client";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { typeMeta } from "@/lib/questionTypes";
import type { BuilderQuestion, QuestionType } from "@/lib/types";
import { AddQuestionMenu } from "./AddQuestionMenu";

interface Props {
  questions: BuilderQuestion[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onAdd: (type: QuestionType) => void;
  onDelete: (q: BuilderQuestion) => void;
}

function Row({
  q, index, selected, onSelect, onDelete,
}: { q: BuilderQuestion; index: number; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const meta = typeMeta(q.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined }}
      className={`sb-row ${selected ? "sb-row-selected" : ""} ${isDragging ? "sb-row-dragging" : ""}`}
      onClick={onSelect}
    >
      {/* Only the handle starts a drag, so clicking the row still selects it. */}
      <button className="drag-handle" aria-label="Drag to reorder" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        ⋮⋮
      </button>
      <span className="type-tile type-tile-sm" style={{ background: meta.color }}>{meta.icon}</span>
      <span className="sb-num">{index + 1}</span>
      <span className={`sb-title ${q.title ? "" : "sb-title-empty"}`}>{q.title || "Your question here"}</span>
      <button
        className="icon-btn sb-delete"
        aria-label="Delete question"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        🗑
      </button>
    </div>
  );
}

export function QuestionSidebar({ questions, selectedId, onSelect, onReorder, onAdd, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sensors = useSensors(
    // distance: require a few px of movement so a plain click isn't treated as a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = questions.findIndex((q) => q.id === active.id);
    const newIdx = questions.findIndex((q) => q.id === over.id);
    onReorder(arrayMove(questions, oldIdx, newIdx).map((q) => q.id));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>Questions</span>
        <span className="muted small">{questions.length}</span>
      </div>

      <div className="sidebar-list">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map((q, i) => (
              <Row
                key={q.id}
                q={q}
                index={i}
                selected={q.id === selectedId}
                onSelect={() => onSelect(q.id)}
                onDelete={() => onDelete(q)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {questions.length === 0 && <div className="muted small sb-empty">No questions yet.</div>}
      </div>

      <div className="sidebar-foot">
        <button className="btn btn-outline btn-block" onClick={() => setMenuOpen((o) => !o)}>
          + Add question
        </button>
        {menuOpen && (
          <AddQuestionMenu
            onClose={() => setMenuOpen(false)}
            onPick={(t) => {
              setMenuOpen(false);
              onAdd(t);
            }}
          />
        )}
      </div>
    </aside>
  );
}
