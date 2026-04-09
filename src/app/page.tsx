/* ================================================================
   Root Page — Redirects to /dashboard (or /login if not authed)
   The dashboard layout handles the auth check
   ================================================================ */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
