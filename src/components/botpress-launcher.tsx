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
    let observer: MutationObserver | undefined;

    const hideNativeLauncherNodes = () => {
      const selectors = [
        ".bpFabWrapper",
        '[class*="bpFabWrapper"]',
        '[class*="bpFabButton"]',
        '[class*="bpFab"]',
        '[class*="bpw-launcher"]',
        '[class*="bpwLauncher"]',
      ];

      selectors.forEach((selector) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
          el.style.setProperty("opacity", "0", "important");
          el.style.setProperty("pointer-events", "none", "important");
          el.style.setProperty("height", "0", "important");
          el.style.setProperty("width", "0", "important");
        });
      });

      // Some Botpress builds render launcher in a dedicated iframe.
      // Hide only launcher-sized iframes so the full chat window remains available.
      document
        .querySelectorAll<HTMLIFrameElement>('iframe[src*="botpress"], iframe[src*="bpcontent.cloud"], iframe[src*="cdn.botpress.cloud"]')
        .forEach((iframe) => {
          const rect = iframe.getBoundingClientRect();
          const style = window.getComputedStyle(iframe);
          const isLikelyLauncherSize = rect.width > 28 && rect.width < 140 && rect.height > 28 && rect.height < 140;
          const isFixedLike = style.position === "fixed" || style.position === "absolute";
          const isBottomRight = rect.right >= window.innerWidth - 180 && rect.bottom >= window.innerHeight - 220;

          if (isLikelyLauncherSize && isFixedLike && isBottomRight) {
            iframe.style.setProperty("display", "none", "important");
            iframe.style.setProperty("visibility", "hidden", "important");
            iframe.style.setProperty("opacity", "0", "important");
            iframe.style.setProperty("pointer-events", "none", "important");
            iframe.style.setProperty("height", "0", "important");
            iframe.style.setProperty("width", "0", "important");
          }
        });

      // Nuclear option: Kill any fixed/absolute div that looks like a launcher
      // (positioned at bottom-right, sized like a button, NOT our custom launcher)
      const potentialLaunchers = document.querySelectorAll('div[style*="fixed"][style*="bottom"][style*="right"], div[style*="absolute"][style*="bottom"][style*="right"]');
      potentialLaunchers.forEach((el) => {
        // Skip our custom neo-launcher button
        if (el.classList.contains("neo-launcher") || el.id === "bp-web-widget") {
          return;
        }

        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isBottomRight = rect.right >= window.innerWidth - 200 && rect.bottom >= window.innerHeight - 150;
        const isSmallish = rect.width > 20 && rect.width < 150 && rect.height > 20 && rect.height < 150;
        const isFixed = style.position === "fixed" || style.position === "absolute";

        if (isFixed && isBottomRight && isSmallish) {
          (el as HTMLElement).style.display = "none";
          (el as HTMLElement).style.visibility = "hidden";
          (el as HTMLElement).style.pointerEvents = "none";
        }
      });
    };

    const check = () => {
      if (!mounted) return;
      setIsReady(isBotpressReady());
      hideNativeLauncherNodes();
    };

    const bindEvents = () => {
      if (!window.botpress || typeof window.botpress.on !== "function") {
        return;
      }

      unsubscribe = window.botpress.on("webchat:initialized", () => {
        if (mounted) {
          setIsReady(true);
        }
        hideNativeLauncherNodes();
      }) as (() => void) | undefined;
    };

    // Botpress loads async: poll briefly, then keep a light heartbeat.
    check();
    bindEvents();
    const fast = setInterval(check, 250);
    const fastStop = setTimeout(() => clearInterval(fast), 6000);
    const slow = setInterval(check, 2000);

    // Catch late re-mounts of native launcher after SPA transitions.
    observer = new MutationObserver(() => {
      hideNativeLauncherNodes();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      mounted = false;
      unsubscribe?.();
      observer?.disconnect();
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
      className="neo-launcher fixed bottom-[104px] right-3 z-[2147483001] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white/80 transition hover:bg-emerald-600 active:scale-95"
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
