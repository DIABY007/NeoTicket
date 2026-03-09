import Link from "next/link";

import { CreateEventForm } from "@/components/organizer/create-event-form";
import { resolvePlatformDiscountPercent } from "@/lib/pricing";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V21h12V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21c1.8-3.3 4.4-5 8-5s6.2 1.7 8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default async function OrganizerCreateEventPage() {
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-28">
      <h1 className="text-xl font-semibold sm:text-2xl">Publier un evenement</h1>
      <p className="mt-1 text-sm text-black/50">
        En quelques secondes, votre evenement est en ligne.
      </p>

      <div className="mt-5">
        <CreateEventForm platformDiscountPercent={platformDiscountPercent} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-2 py-2">
          <Link
            href="/"
            className="flex min-w-[88px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-black/60"
          >
            <IconHome />
            Evenements
          </Link>

          <Link
            href="/organizer/new"
            className="flex min-w-[88px] flex-col items-center gap-1 rounded-xl neo-gradient px-3 py-2 text-xs text-white"
          >
            <IconPlus />
            Ajouter
          </Link>

          <Link
            href="/scanner/scan"
            className="flex min-w-[88px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-black/60"
          >
            <IconScan />
            Scanner
          </Link>

          <Link
            href="/?tab=profile"
            className="flex min-w-[88px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-black/60"
          >
            <IconUser />
            Profil
          </Link>
        </div>
      </nav>
    </main>
  );
}