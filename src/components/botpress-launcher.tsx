"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    botpress?: {
      toggle?: () => void;
      on?: (event: string, handler: (...args: unknown[]) => void) => (() => void) | void;
    };
  }
}

export function BotpressLauncher() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = () => {
      if (!mounted) return;
      const ready = Boolean(window.botpress && typeof window.botpress.toggle === "function");
      setIsReady(ready);
    };

    // Botpress loads async: poll briefly, then keep a light heartbeat.
    check();
    const fast = setInterval(check, 250);
    const fastStop = setTimeout(() => clearInterval(fast), 6000);
    const slow = setInterval(check, 2000);

    return () => {
      mounted = false;
      clearInterval(fast);
      clearTimeout(fastStop);
      clearInterval(slow);
    };
  }, [pathname]);

  if (!isReady) return null;

  return (
    <button
      type="button"
      onClick={() => window.botpress?.toggle?.()}
      className="fixed bottom-[104px] right-3 z-[2147483001] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white/80 transition hover:bg-emerald-600 active:scale-95"
      aria-label="Ouvrir le chat"
      title="Discuter avec NeoTicket"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
