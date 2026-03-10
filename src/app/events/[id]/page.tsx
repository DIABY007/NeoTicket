import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EventCatalog } from "@/components/buyer/event-catalog";
import { buildEventSlug, cityLabelToSlug, citySlugToLabel } from "@/lib/event-slug";
import {
  computeFinalPrice,
  computeOrganizerDiscountPercent,
  resolvePlatformDiscountPercent,
} from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

async function getPublishedEvents() {
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

  if (error || !data) {
    return [] as BuyerEvent[];
  }

  return data.map((event) => {
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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (UUID_REGEX.test(id)) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const city = citySlugToLabel(id);
  return {
    title: `Événements à ${city} — Billets & Tickets`,
    description: `Découvrez les événements à ${city}. Achetez vos tickets via Orange Money et recevez votre QR Code sur WhatsApp.`,
    alternates: {
      canonical: `/events/${id}`,
    },
    openGraph: {
      title: `Événements à ${city} — Billets & Tickets | NeoTicket`,
      description: `Billetterie locale à ${city} avec paiement Orange Money et réception ticket QR sur WhatsApp.`,
      url: `/events/${id}`,
      type: "website",
      images: [
        {
          url: "/logo.svg",
          width: 1200,
          height: 630,
          alt: `Événements à ${city} — NeoTicket`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Événements à ${city} — Billets & Tickets | NeoTicket`,
      description: `Découvrez les événements à ${city}. Paiement Orange Money et QR Code WhatsApp.`,
    },
  };
}

export default async function EventsDynamicSegmentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const refParam = typeof resolvedSearchParams.ref === "string" ? resolvedSearchParams.ref : undefined;

  if (UUID_REGEX.test(id)) {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("events")
      .select("id, slug, title, city, date")
      .eq("id", id)
      .maybeSingle<{ id: string; slug: string; title: string; city: string | null; date: string }>();

    if (data) {
      const slug = data.slug || buildEventSlug(data);
      const refSuffix = refParam ? `?ref=${encodeURIComponent(refParam)}` : "";
      redirect(`/e/${slug}${refSuffix}`);
    }

    redirect("/events");
  }

  const citySlug = id;
  const cityLabel = citySlugToLabel(citySlug);
  const events = (await getPublishedEvents()).filter(
    (event) => cityLabelToSlug(event.city ?? "") === citySlug,
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Événements", item: `${siteUrl}/events` },
      { "@type": "ListItem", position: 3, name: cityLabel, item: `${siteUrl}/events/${citySlug}` },
    ],
  };

  return (
    <main className="min-h-screen p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="mx-auto w-full max-w-6xl">
        <nav className="mb-4 text-sm text-black/60" aria-label="Fil d'Ariane">
          <Link href="/" className="hover:text-neo-teal transition-colors">Accueil</Link>
          <span className="mx-1.5">/</span>
          <Link href="/events" className="hover:text-neo-teal transition-colors">Événements</Link>
          <span className="mx-1.5">/</span>
          <span className="text-black/90 font-medium">{cityLabel}</span>
        </nav>
        <h1 className="text-2xl font-semibold">Événements à {cityLabel}</h1>
        <p className="mt-1 text-sm text-black/70">
          Explorez les prochaines sorties et achetez vos billets en ligne.
        </p>

        <div className="mt-6">
          <EventCatalog events={events} />
        </div>
      </section>
    </main>
  );
}
