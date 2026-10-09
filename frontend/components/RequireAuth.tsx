"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/** Wraps every creator page. Anonymous visitors are sent to /login and returned here afterwards. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anon") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status === "error")
    return (
      <div className="fullscreen-msg">
        <h1>Can&apos;t reach the server</h1>
        <p className="muted">Check that the backend is running, then try again.</p>
        <button className="btn btn-primary" onClick={retry}>Retry</button>
      </div>
    );
  if (status !== "authed") return <div className="fullscreen-msg"><div className="spinner" /></div>;
  return <>{children}</>;
}
