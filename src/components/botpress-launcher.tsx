"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const BOTPRESS_INJECT_SRC = "https://cdn.botpress.cloud/webchat/v3.6/inject.js";
const BOTPRESS_CONFIG_SRC = "https://files.bpcontent.cloud/2026/03/10/03/20260310031010-SG3OZF6G.js";

declare global {
  interface Window {
    botpress?: {
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

function ensureScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureBotpressReady() {
  if (isBotpressReady()) {
    return true;
  }

  try {
    await ensureScript(BOTPRESS_INJECT_SRC, "bp-inject-script");
    await ensureScript(BOTPRESS_CONFIG_SRC, "bp-config-script");
  } catch {
    return false;
  }

  for (let i = 0; i < 20; i += 1) {
    if (isBotpressReady()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return false;
}

export function BotpressLauncher() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = () => {
      if (!mounted) return;
      setIsReady(isBotpressReady());
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

  const openChat = async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    try {
      let ready = isBotpressReady();
      if (!ready) {
        ready = await ensureBotpressReady();
        setIsReady(ready);
      }

      if (!ready) {
        return;
      }

      if (typeof window.botpress?.open === "function") {
        window.botpress.open();
        return;
      }

      if (typeof window.botpress?.toggle === "function") {
        window.botpress.toggle();
      }
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void openChat();
      }}
      className="fixed bottom-[104px] right-3 z-[2147483001] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white/80 transition hover:bg-emerald-600 active:scale-95"
      aria-label="Ouvrir le chat"
      title={isReady ? "Discuter avec NeoTicket" : "Initialisation du chat..."}
      aria-busy={isOpening}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
