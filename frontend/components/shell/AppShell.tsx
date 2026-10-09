"use client";
/**
 * The app chrome of the creator area: optional AI panel on the left, then the top bar,
 * the product tabs, and the page body. Used by the dashboard and the "coming soon" sections.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  IconAutomations, IconBrand, IconChevronDown, IconContacts, IconForms, IconHelp, IconInsights,
  IconIntegrations, IconPages, IconResearch, IconSparkle, IconDiamond,
} from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth";
import { readPref, writePref } from "@/lib/prefs";
import { AiPanel } from "./AiPanel";

export type Section = "forms" | "contacts" | "automations" | "insights" | "pages" | "research";

const TABS: { key: Section; label: string; href: string; icon: React.ReactNode; badge?: "premium" | "beta" }[] = [
  { key: "forms", label: "Forms", href: "/dashboard", icon: <IconForms /> },
  { key: "contacts", label: "Contacts", href: "/contacts", icon: <IconContacts /> },
  { key: "automations", label: "Automations", href: "/automations", icon: <IconAutomations /> },
  { key: "insights", label: "Insights", href: "/insights", icon: <IconInsights />, badge: "premium" },
  { key: "pages", label: "Pages", href: "/pages", icon: <IconPages />, badge: "beta" },
];

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export function AppShell({ active, children }: { active: Section; children: React.ReactNode }) {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [aiOpen, setAiOpen] = useState(true);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = user?.name ?? "Account";

  useEffect(() => {
    if (!userMenu) return;
    const h = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setUserMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenu]);

  // Restore the panel state after mount (reading localStorage during render would break SSR hydration).
  useEffect(() => setAiOpen(readPref("aiOpen", true)), []);
  const setAi = (open: boolean) => {
    setAiOpen(open);
    writePref("aiOpen", open);
  };

  const soon = (what: string) => () => toast.info(`${what} is coming soon`);

  return (
    <div className={`tf-app ${aiOpen ? "tf-app-ai" : ""}`}>
      {aiOpen && <AiPanel onClose={() => setAi(false)} />}

      <div className="tf-main">
        <header className="tf-top">
          <div className="tf-top-left">
            <span className="tf-logo-bar" aria-hidden />
            <span className="tf-org-avatar" aria-hidden>{initialsOf(name)[0]}</span>
            <span className="tf-org-name">{name}</span>
            <IconChevronDown size={16} />
            {!aiOpen && (
              <button className="btn btn-outline btn-sm btn-pill tf-ai-open" onClick={() => setAi(true)}>
                <IconSparkle size={15} /> Typeform AI
              </button>
            )}
          </div>
          <div className="tf-top-right">
            <button className="tf-top-link" onClick={soon("Integrations")}><IconIntegrations /> Integrations</button>
            <button className="tf-top-link" onClick={soon("Brand kit")}><IconBrand /> Brand kit</button>
            <button className="btn tf-plans" onClick={soon("Plans & billing")}>View plans</button>
            <button className="icon-btn" aria-label="Help" onClick={soon("Help center")}><IconHelp size={20} /></button>
            <div className="menu-wrap" ref={menuRef}>
              <button className="tf-avatar" aria-label="Account menu" aria-haspopup="menu" aria-expanded={userMenu} onClick={() => setUserMenu((o) => !o)}>
                {initialsOf(name)}
              </button>
              {userMenu && (
                <div className="menu" role="menu">
                  <div className="menu-user">
                    <strong>{name}</strong>
                    <span className="muted small">{user?.email}</span>
                  </div>
                  <div className="menu-sep" />
                  <button className="menu-item" onClick={() => void logout()}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="tf-board">
          <nav className="tf-tabs" aria-label="Products">
            {TABS.map((t) => (
              <Link key={t.key} href={t.href} className={`tf-tab ${active === t.key ? "tf-tab-active" : ""}`}>
                {t.icon}
                {t.label}
                {t.badge === "premium" && <span className="tf-gem"><IconDiamond size={13} /></span>}
                {t.badge === "beta" && <span className="beta beta-blue">Beta</span>}
              </Link>
            ))}
            <span className="tf-tab-sep" aria-hidden />
            <Link href="/research" className={`tf-tab ${active === "research" ? "tf-tab-active" : ""}`}>
              <IconResearch /> Research Flow
            </Link>
          </nav>
          <div className="tf-board-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
