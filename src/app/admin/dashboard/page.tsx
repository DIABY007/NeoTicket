import Image from "next/image";

import { ClosureDashboardPanel } from "@/components/admin/closure-dashboard-panel";
import { PlatformDiscountPanel } from "@/components/admin/platform-discount-panel";
import { requireAdminServerSession } from "@/lib/auth/admin-guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  await requireAdminServerSession();

  /* Pending payment count for the badge */
  let pendingCount = 0;
  try {
    const supabase = getSupabaseServerClient();
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } catch {
    /* ignore – badge will show 0 */
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6">
      {/* ── Compact toolbar header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="NeoTicket" width={36} height={36} priority />
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Pilotage</h1>
            <p className="text-xs text-black/50">Centre de commande admin</p>
          </div>
        </div>
        <a
          href="/admin/validate-payments"
          className="relative inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-md active:scale-[0.97] transition-transform"
        >
          {/* Bell icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0" />
          </svg>
          Validation
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </a>
      </div>

      {/* ── KPI Grid + Panels ── */}
      <ClosureDashboardPanel />

      <PlatformDiscountPanel />
    </main>
  );
}
