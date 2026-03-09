import type { Metadata } from "next";

import { EventCatalog } from "@/components/buyer/event-catalog";
import { cityLabelToSlug } from "@/lib/event-slug";
import {
  computeFinalPrice,
  computeOrganizerDiscountPercent,
  resolvePlatformDiscountPercent,
} from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

export const metadata: Metadata = {
  title: "Evenements au Burkina Faso - Billets & Tickets | NeoTicket",
  description:
    "Decouvrez les evenements a venir au Burkina Faso. Achetez vos billets via Orange Money et recevez votre QR Code sur WhatsApp.",
  alternates: {
    canonical: "/events",
  },
  openGraph: {
    title: "Evenements au Burkina Faso - Billets & Tickets | NeoTicket",
    description:
      "Decouvrez les evenements a venir au Burkina Faso. Paiement Orange Money et ticket QR sur WhatsApp.",
    url: "/events",
    type: "website",
  },
};

type BuyerEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  price: number;
  official_price: number;
  organizer_price: number;
  platform_discount_percent: number;
  organizer_discount_percent: number;
  final_price: number;
  city: string | null;
  image_url: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

export default async function EventsPage() {
  const supabase = getSupabaseServerClient();
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, description, date, end_date, price, official_price, organizer_price, city, image_url, status")
    .eq("status", "published")
    .order("date", { ascending: true })
    .returns<Omit<
      BuyerEvent,
      "platform_discount_percent" | "organizer_discount_percent" | "final_price"
    >[]>();

  const events =
    error || !data
      ? []
      : data.map((event) => {
          const officialPrice = Number(event.official_price ?? event.price);
          const organizerPrice = Number(event.organizer_price ?? event.price);

          return {
            ...event,
            official_price: officialPrice,
            organizer_price: organizerPrice,
            platform_discount_percent: platformDiscountPercent,
            organizer_discount_percent: computeOrganizerDiscountPercent(
              officialPrice,
              organizerPrice,
            ),
            final_price: computeFinalPrice(organizerPrice, platformDiscountPercent),
          };
        });

  const uniqueCities = Array.from(
    new Set(events.map((event) => (event.city ?? "").trim()).filter(Boolean)),
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Evenements", item: `${siteUrl}/events` },
    ],
  };

  return (
    <main className="min-h-screen p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold">Evenements au Burkina Faso</h1>
        <p className="mt-1 text-sm text-black/70">
          Billetterie en ligne avec Orange Money et QR Code WhatsApp.
        </p>

        {uniqueCities.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {uniqueCities.map((city) => (
              <a
                key={city}
                href={`/events/${cityLabelToSlug(city)}`}
                className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium text-black/70 hover:border-black/40"
              >
                {city}
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          <EventCatalog events={events} />
        </div>
      </section>
    </main>
  );
}
