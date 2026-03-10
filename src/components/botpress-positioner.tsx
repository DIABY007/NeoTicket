"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Bottom offset in px — must clear the fixed navbar (~60px) + safe area
const BOTTOM_PX = 112;
const RIGHT_PX = 14;
const MAX_Z_INDEX = 2147483000;

const BP_IDS = ["bp-web-widget", "bp-webchat", "botpress-webchat", "bp-web-widget-container"];
const BP_TAGS = ["bp-webchat"];
const BP_CLASS_PATTERNS = ["bpwidget", "bpfab", "fabbutton", "fabwrapper", "botpress"];

function applyToEl(el: HTMLElement) {
  const position = getComputedStyle(el).position;
  if (position !== "fixed" && position !== "absolute" && position !== "sticky") {
    return;
  }

  el.style.setProperty("bottom", `${BOTTOM_PX}px`, "important");
  el.style.setProperty("right", `${RIGHT_PX}px`, "important");
  el.style.setProperty("z-index", String(MAX_Z_INDEX), "important");
  el.style.setProperty("visibility", "visible", "important");
  el.style.setProperty("opacity", "1", "important");
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

  // Match runtime-generated Botpress nodes, including iframe wrappers.
  document
    .querySelectorAll<HTMLElement>(
      [
        'iframe[src*="botpress"]',
        'iframe[src*="bpcontent.cloud"]',
        'iframe[src*="cdn.botpress.cloud"]',
        '[id*="bp"]',
        '[id*="botpress"]',
        '[class*="bp"]',
        '[class*="botpress"]',
      ].join(","),
    )
    .forEach((el) => {
      const id = (el.id ?? "").toLowerCase();
      const cls = (el.className ?? "").toString().toLowerCase();
      const tag = (el.tagName ?? "").toLowerCase();
      const matchesPattern = BP_CLASS_PATTERNS.some((p) => cls.includes(p));

      if (tag === "iframe" || id.includes("bp") || id.includes("botpress") || matchesPattern) {
        applyToEl(el);
        found = true;
      }
    });

  return found;
}

export function BotpressPositioner() {
  const pathname = usePathname();

  useEffect(() => {
    // Immediate pass + short burst for just-mounted pages.
    repositionBotpress();
    const quickTimer = setInterval(() => {
      repositionBotpress();
    }, 250);
    const quickStop = setTimeout(() => {
      clearInterval(quickTimer);
    }, 4000);

    // Keep a lightweight persistent pass to survive delayed widget remounts.
    const persistentTimer = setInterval(() => {
      repositionBotpress();
    }, 1500);

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
            tag === "iframe" ||
            BP_CLASS_PATTERNS.some((p) => cls.includes(p))
          ) {
            repositionBotpress();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(quickTimer);
      clearTimeout(quickStop);
      clearInterval(persistentTimer);
      observer.disconnect();
    };
  }, [pathname]); // Re-runs on every page change

  return null;
}
