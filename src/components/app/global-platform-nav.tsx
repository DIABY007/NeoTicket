"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function itemClass(isActive: boolean) {
  return `inline-flex min-w-[88px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
    isActive ? "neo-gradient text-white" : "text-black/50 hover:text-neo-teal"
  }`;
}

export function GlobalPlatformNav() {
  const pathname = usePathname();

  const hasDedicatedIconNav =
    pathname === "/" ||
    pathname === "/organizer/new" ||
    pathname === "/scanner/scan" ||
    /^\/organizer\/events\/[^/]+\/edit$/.test(pathname);

  // Hide this global nav when the page already renders its own icon nav.
  if (hasDedicatedIconNav) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/6 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-2 py-2">
        <Link href="/" className={itemClass(pathname === "/")}>Evenements</Link>
        <Link href="/buyer/tickets" className={itemClass(pathname.startsWith("/buyer/tickets"))}>Tickets</Link>
        <Link href="/?tab=profile" className={itemClass(pathname.startsWith("/profile"))}>Profil</Link>
      </div>
    </nav>
  );
}
