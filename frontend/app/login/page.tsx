import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

// useSearchParams() (for ?next=) needs a Suspense boundary so the page can still be pre-rendered.
export default function Page() {
  return (
    <Suspense>
      <AuthScreen mode="login" />
    </Suspense>
  );
}
