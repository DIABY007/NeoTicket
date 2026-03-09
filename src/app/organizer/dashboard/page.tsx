import Image from "next/image";

import { OrganizerDashboardContent } from "@/components/organizer/organizer-dashboard-content";
import { resolvePlatformDiscountPercent } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrganizerDashboardPage() {
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="NeoTicket" width={36} height={36} priority />
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Organisateur</h1>
          <p className="mt-1 text-sm text-black/70">
            Suivez vos performances et creez de nouveaux evenements.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <OrganizerDashboardContent platformDiscountPercent={platformDiscountPercent} />
      </div>
    </main>
  );
}
