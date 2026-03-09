"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventPageActionsProps = {
  title: string;
};

export function EventPageActions({ title }: EventPageActionsProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);

  const copyLinkFallback = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  };

  const onShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text: `Decouvre cet evenement: ${title}`,
            url,
          });
          setFeedback("Lien partage avec succes.");
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") {
            setFeedback("Partage annule.");
            return;
          }
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Lien copie dans le presse-papiers.");
        return;
      }

      if (copyLinkFallback(url)) {
        setFeedback("Lien copie dans le presse-papiers.");
        return;
      }

      setFeedback("Impossible de partager automatiquement. Copiez l'URL depuis la barre d'adresse.");
    } catch {
      if (copyLinkFallback(url)) {
        setFeedback("Lien copie dans le presse-papiers.");
        return;
      }

      setFeedback("Impossible de partager automatiquement. Copiez l'URL depuis la barre d'adresse.");
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 text-base font-semibold text-black/70 transition hover:border-neo-teal/30 hover:text-neo-teal"
        aria-label="Quitter la page evenement"
        title="Quitter"
      >
        X
      </button>

      <button
        type="button"
        onClick={() => {
          void onShare();
        }}
        className="rounded-xl border border-black/8 px-3 py-2 text-xs font-semibold text-black transition hover:border-neo-teal/30 hover:text-neo-teal"
      >
        Partager le lien
      </button>

      {feedback ? <p className="w-full text-xs text-black/60">{feedback}</p> : null}
    </div>
  );
}
