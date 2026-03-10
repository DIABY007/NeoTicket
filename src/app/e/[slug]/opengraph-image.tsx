import { ImageResponse } from "next/og";

import { computeFinalPrice, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 300;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type EventOpenGraphData = {
  title: string;
  date: string;
  city: string | null;
  image_url: string | null;
  price: number;
  organizer_price: number;
  status: "draft" | "published" | "ended" | "cancelled";
};

function formatDateLabel(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPriceLabel(amount: number) {
  if (Math.round(amount) <= 0) {
    return "GRATUIT";
  }

  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

async function getPublicEvent(slug: string) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("title, date, city, image_url, price, organizer_price, status")
    .eq("slug", slug)
    .in("status", ["published", "ended", "cancelled"])
    .maybeSingle<EventOpenGraphData>();

  return data;
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f766e, #111827)",
            color: "white",
            fontSize: 52,
            fontWeight: 800,
          }}
        >
          NeoTicket
        </div>
      ),
      size,
    );
  }

  const platformDiscountPercent = await resolvePlatformDiscountPercent();
  const finalPrice = computeFinalPrice(Number(event.organizer_price ?? event.price), platformDiscountPercent);
  const dateLabel = formatDateLabel(event.date);
  const cityLabel = event.city ?? "Burkina Faso";
  const priceLabel = formatPriceLabel(finalPrice);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          position: "relative",
          display: "flex",
          overflow: "hidden",
          background: "#0b1220",
          color: "white",
        }}
      >
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(0.55)",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 68%, rgba(0,0,0,0.92) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "44px",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              padding: "10px 16px",
              borderRadius: "999px",
              background: "rgba(14,165,233,0.22)",
              border: "1px solid rgba(125,211,252,0.5)",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            NeoTicket
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                maxWidth: "980px",
                fontSize: 64,
                lineHeight: 1.08,
                fontWeight: 900,
              }}
            >
              {event.title}
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                fontSize: 28,
                opacity: 0.95,
              }}
            >
              <span>{dateLabel}</span>
              <span>•</span>
              <span>{cityLabel}</span>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "6px",
                alignSelf: "flex-start",
                padding: "12px 18px",
                borderRadius: "14px",
                background: "rgba(16,185,129,0.2)",
                border: "1px solid rgba(110,231,183,0.7)",
                fontSize: 34,
                fontWeight: 800,
              }}
            >
              {priceLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
