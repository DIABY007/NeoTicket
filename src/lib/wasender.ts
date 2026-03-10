type SendOtpInput = {
  to: string;
  code: string;
};

type SendTextInput = {
  to: string;
  text: string;
};

type SendImageInput = {
  to: string;
  text?: string;
  imageUrl: string;
};

type SendTicketInput = {
  to: string;
  eventTitle: string;
  eventDate?: string;
  qrHash: string;
  qrLink?: string;
};

const WHATSAPP_MIN_DELAY_MS = 5_000;
let whatsappSendQueue: Promise<void> = Promise.resolve();
let lastWhatsAppAttemptAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithWhatsAppThrottle<T>(operation: () => Promise<T>) {
  let result: T | undefined;
  let operationError: unknown;

  const queueTask = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, lastWhatsAppAttemptAt + WHATSAPP_MIN_DELAY_MS - now);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      result = await operation();
    } catch (error) {
      operationError = error;
    } finally {
      // Rate-limit by attempt so retries also respect provider pacing.
      lastWhatsAppAttemptAt = Date.now();
    }
  };

  whatsappSendQueue = whatsappSendQueue.catch(() => undefined).then(queueTask);
  await whatsappSendQueue;

  if (operationError) {
    throw operationError;
  }

  return result as T;
}

function isPublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function sendWhatsAppTextMessage({ to, text }: SendTextInput) {
  await runWithWhatsAppThrottle(async () => {
    const apiUrl =
      process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api/send-message";
    const apiKey = process.env.WASENDER_API_KEY;

    if (!apiKey) {
      throw new Error("WASENDER_API_KEY is missing");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to,
        text,
      }),
    });

    const responseText = await response.text();
    let payload: { success?: boolean; error?: string; message?: string } | null = null;
    try {
      payload = responseText
        ? (JSON.parse(responseText) as { success?: boolean; error?: string; message?: string })
        : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`Wasender request failed (${response.status}): ${responseText}`);
    }

    if (payload && payload.success === false) {
      throw new Error(payload.error || payload.message || "Wasender rejected text message.");
    }
  });
}

export async function sendWhatsAppImageMessage({ to, text, imageUrl }: SendImageInput) {
  await runWithWhatsAppThrottle(async () => {
    const apiUrl =
      process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api/send-message";
    const apiKey = process.env.WASENDER_API_KEY;

    if (!apiKey) {
      throw new Error("WASENDER_API_KEY is missing");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to,
        text,
        imageUrl,
      }),
    });

    const responseText = await response.text();
    let payload:
      | {
          success?: boolean;
          error?: string;
          message?: string;
          data?: { status?: string };
          status?: string;
        }
      | null = null;
    try {
      payload = responseText
        ? (JSON.parse(responseText) as { success?: boolean; error?: string; message?: string })
        : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`Wasender image request failed (${response.status}): ${responseText}`);
    }

    if (payload && payload.success === false) {
      throw new Error(payload.error || payload.message || "Wasender rejected image message.");
    }

    const providerStatus = payload?.data?.status || payload?.status;
    if (providerStatus && providerStatus.toLowerCase() === "failed") {
      throw new Error("Wasender reported failed status for image message.");
    }
  });
}

export async function sendOtpWhatsApp({ to, code }: SendOtpInput) {
  const text = `Votre code NeoTicket est ${code}. Il expire dans 5 minutes.`;

  await sendWhatsAppTextMessage({ to, text });
}

export async function sendTicketWhatsApp({
  to,
  eventTitle,
  eventDate,
  qrHash,
  qrLink,
}: SendTicketInput) {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleString("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "date a confirmer";

  const text = [
    `Paiement confirme pour ${eventTitle}.`,
    `Date: ${formattedDate}`,
    `Code ticket: ${qrHash}`,
    qrLink ? `QR: ${qrLink}` : "QR: disponible dans votre espace.",
    "IMPORTANT: ce code QR est a usage unique.",
    "Ne le transferez pas, ne le partagez pas et ne le publiez pas.",
    "Il doit etre scanne uniquement le jour de l'evenement.",
    "Merci d'avoir choisi NeoTicket.",
  ].join("\n");

  if (qrLink) {
    if (!isPublicUrl(qrLink)) {
      throw new Error(
        `QR image URL non publique pour Wasender: ${qrLink}. Configurez NEXT_PUBLIC_APP_URL ou APP_PUBLIC_URL avec une URL publique.`,
      );
    }

    try {
      await sendWhatsAppImageMessage({
        to,
        text,
        imageUrl: qrLink,
      });
      return;
    } catch {
      try {
        await sendWhatsAppImageMessage({
          to,
          text,
          imageUrl: qrLink,
        });
        return;
      } catch {
        // Fallback to text so buyer still receives ticket instructions.
      }
    }
  }

  await sendWhatsAppTextMessage({ to, text });
}
