"use client";
import Link from "next/link";
import { AppShell, type Section } from "./AppShell";

interface Props {
  section: Section;
  title: string;
  blurb: string;
}

/** "Coming soon" body for product areas the assignment lists as placeholders. */
export function SectionPlaceholder({ section, title, blurb }: Props) {
  return (
    <AppShell active={section}>
      <div className="soon-page">
        <span className="badge">Coming soon</span>
        <h1>{title}</h1>
        <p className="muted">{blurb}</p>
        <Link href="/dashboard" className="btn btn-primary">Back to forms</Link>
      </div>
    </AppShell>
  );
}
