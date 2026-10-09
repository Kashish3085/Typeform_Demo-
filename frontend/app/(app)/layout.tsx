import { RequireAuth } from "@/components/RequireAuth";

// Route group: the (app) folder doesn't appear in URLs. Everything inside needs a logged-in user.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
