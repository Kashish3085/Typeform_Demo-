"use client";
import { useLayoutEffect, useRef } from "react";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">;

/** Textarea that grows with its content - used for inline-editable titles. */
export function AutoTextarea({ value, onChange, className, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px"; // reset so it can also shrink
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault(); // titles are single paragraphs
        onKeyDown?.(e);
      }}
      {...rest}
    />
  );
}
