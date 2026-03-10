"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function itemClass(isActive: boolean) {
  return `flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
    isActive ? "neo-gradient text-white" : "text-black/50 hover:text-neo-teal"
  }`;
}

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

function IconScan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

export function GlobalPlatformNav() {
  const pathname = usePathname();
  // Read ?tab= client-side to avoid useSearchParams/Suspense issues
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get("tab"));
  }, [pathname]);

  const isEventsActive = pathname === "/" && tab !== "profile";
  const isProfileActive = pathname === "/" && tab === "profile";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/6 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-2 py-2">
        {/* Use <a> to force full page reload so SSR data is fresh */}
        <a href="/" className={itemClass(isEventsActive)}>
          <IconHome />
          Evenements
        </a>

        <Link href="/organizer/new" className={itemClass(pathname === "/organizer/new")}>
          <IconPlus />
          Ajouter
        </Link>

        <Link href="/scanner/scan" className={itemClass(pathname === "/scanner/scan")}>
          <IconScan />
          Scanner
        </Link>

        <a href="/?tab=profile" className={itemClass(isProfileActive)}>
          <IconUser />
          Profil
        </a>
      </div>
    </nav>
  );
}
