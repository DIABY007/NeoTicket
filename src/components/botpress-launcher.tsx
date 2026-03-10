"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    botpress?: {
      init?: (options: unknown) => void;
      toggle?: () => void;
      open?: () => void;
      on?: (event: string, handler: (...args: unknown[]) => void) => (() => void) | void;
    };
  }
}

function isBotpressReady() {
  return Boolean(
    window.botpress &&
      (typeof window.botpress.toggle === "function" || typeof window.botpress.open === "function"),
  );
}

export function BotpressLauncher() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const check = () => {
      if (!mounted) return;
      setIsReady(isBotpressReady());
    };

    const bindEvents = () => {
      if (!window.botpress || typeof window.botpress.on !== "function") {
        return;
      }

      unsubscribe = window.botpress.on("webchat:initialized", () => {
        if (mounted) {
          setIsReady(true);
        }
      }) as (() => void) | undefined;
    };

    // Botpress loads async: poll briefly, then keep a light heartbeat.
    check();
    bindEvents();
    const fast = setInterval(check, 250);
    const fastStop = setTimeout(() => clearInterval(fast), 6000);
    const slow = setInterval(check, 2000);

    return () => {
      mounted = false;
      unsubscribe?.();
      clearInterval(fast);
      clearTimeout(fastStop);
      clearInterval(slow);
    };
  }, [pathname]);

  const openChat = () => {
    if (typeof window.botpress?.open === "function") {
      window.botpress.open();
      return;
    }

    if (typeof window.botpress?.toggle === "function") {
      window.botpress.toggle();
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        openChat();
      }}
      className="fixed right-3 z-[2147483001] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white/80 transition hover:bg-emerald-600 active:scale-95"
      style={{ bottom: "var(--chat-offset)" }}
      aria-label="Ouvrir le chat"
      title={isReady ? "Discuter avec NeoTicket" : "Initialisation du chat..."}
      aria-disabled={!isReady}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
