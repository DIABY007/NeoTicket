"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Bottom offset in px — must clear the fixed navbar (~60px) + safe area
const BOTTOM_PX = 80;

const BP_IDS = ["bp-web-widget", "bp-webchat", "botpress-webchat", "bp-web-widget-container"];
const BP_TAGS = ["bp-webchat"];
const BP_CLASS_PATTERNS = ["bpWidget", "bpFab", "bpFabButton", "FabButton", "fabButton", "FabWrapper"];

function applyToEl(el: HTMLElement) {
  el.style.setProperty("bottom", `${BOTTOM_PX}px`, "important");
  el.style.setProperty("right", "16px", "important");
  el.style.setProperty("z-index", "9999", "important");
  el.style.setProperty("visibility", "visible", "important");
  el.style.setProperty("opacity", "1", "important");
  el.style.setProperty("display", "block", "important");
}

function repositionBotpress(): boolean {
  let found = false;

  BP_IDS.forEach((id) => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) { applyToEl(el); found = true; }
  });

  BP_TAGS.forEach((tag) => {
    document.querySelectorAll<HTMLElement>(tag).forEach((el) => {
      applyToEl(el); found = true;
    });
  });

  BP_CLASS_PATTERNS.forEach((pattern) => {
    document.querySelectorAll<HTMLElement>(`[class*="${pattern}"]`).forEach((el) => {
      // Only target top-level fixed/absolute positioned elements (the outer container)
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "absolute") {
        applyToEl(el); found = true;
      }
    });
  });

  return found;
}

export function BotpressPositioner() {
  const pathname = usePathname();

  useEffect(() => {
    let attempts = 0;
    let found = false;

    // Poll every 300ms up to 15s — re-runs on every navigation
    const timer = setInterval(() => {
      if (repositionBotpress()) found = true;
      if (found && ++attempts >= 5) clearInterval(timer);
      if (++attempts >= 50) clearInterval(timer);
    }, 300);

    // MutationObserver: re-apply instantly if Botpress re-mounts its container
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as HTMLElement;
          const id = (el.id ?? "").toLowerCase();
          const tag = (el.tagName ?? "").toLowerCase();
          const cls = (el.className ?? "").toString().toLowerCase();

          if (
            id.includes("bp") ||
            id.includes("botpress") ||
            tag === "bp-webchat" ||
            BP_CLASS_PATTERNS.some((p) => cls.includes(p.toLowerCase()))
          ) {
            applyToEl(el);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: false });

    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [pathname]); // Re-runs on every page change

  return null;
}
