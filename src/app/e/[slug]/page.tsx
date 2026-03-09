import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BuyTicketButton } from "@/components/buyer/buy-ticket-button";
import { EventPageActions } from "@/components/buyer/event-page-actions";
import { cityLabelToSlug } from "@/lib/event-slug";
import {
  computeFinalPrice,
  computeOrganizerDiscountPercent,
  resolvePlatformDiscountPercent,
} from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 300;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

type EventDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  price: number;
  official_price: number;
  organizer_price: number;
  city: string | null;
  venue: string | null;
  image_url: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

type Props = {
  params: Promise<{ slug: string }>;
};

async function getEventFromSlug(slug: string) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, slug, title, description, date, end_date, price, official_price, organizer_price, city, venue, image_url, status")
    .eq("slug", slug)
    .maybeSingle<EventDetail>();

  return data;
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventFromSlug(slug);

  if (!event) {
    return {
      title: "Événement introuvable | NeoTicket",
      description: "Cet événement n'est plus disponible sur NeoTicket.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const dateLabel = formatEventDate(event.date);
  const cityLabel = event.city ?? "Burkina Faso";
  const title = `${event.title} — Billets & Tickets à ${cityLabel}`;
  const description = `Achetez vos billets pour ${event.title} le ${dateLabel} à ${cityLabel}. Paiement sécurisé via Orange Money. Recevez votre QR Code par WhatsApp.`;
  const canonicalPath = `/e/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      images: event.image_url
        ? [
            {
              url: event.image_url,
              width: 1200,
              height: 630,
              alt: `Affiche de l'evenement ${event.title}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

export default async function EventDetailsBySlugPage({ params }: Props) {
  const { slug } = await params;
  const data = await getEventFromSlug(slug);
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-black/6 bg-white p-6">
          <h1 className="text-2xl font-bold">Événement introuvable</h1>
          <p className="mt-2 text-sm text-black/70">
            L&apos;événement demandé n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <Link href="/events" className="neo-btn mt-4 inline-block rounded-xl px-4 py-2 text-sm">
            Retour au catalogue
          </Link>
        </section>
      </main>
    );
  }

  const officialPrice = Number(data.official_price ?? data.price);
  const organizerPrice = Number(data.organizer_price ?? data.price);
  const organizerDiscountPercent = computeOrganizerDiscountPercent(
    officialPrice,
    organizerPrice,
  );
  const finalPrice = computeFinalPrice(organizerPrice, platformDiscountPercent);
  const availability =
    data.status === "published"
      ? "https://schema.org/InStock"
      : "https://schema.org/SoldOut";
  const eventUrl = `${siteUrl}/e/${slug}`;

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: data.title,
    startDate: data.date,
    endDate: data.end_date ?? undefined,
    eventStatus:
      data.status === "ended"
        ? "https://schema.org/EventCompleted"
        : data.status === "cancelled"
          ? "https://schema.org/EventCancelled"
          : "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: data.venue ?? data.city ?? "Lieu à confirmer",
      address: {
        "@type": "PostalAddress",
        addressLocality: data.city ?? "Burkina Faso",
        addressCountry: "BF",
      },
    },
    image: data.image_url ? [data.image_url] : undefined,
    description: data.description ?? undefined,
    offers: {
      "@type": "Offer",
      url: eventUrl,
      price: String(finalPrice),
      priceCurrency: "XOF",
      availability,
    },
    organizer: {
      "@type": "Organization",
      name: "NeoTicket",
      url: siteUrl,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Événements",
        item: `${siteUrl}/events`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: data.title,
        item: eventUrl,
      },
    ],
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="mx-auto max-w-3xl rounded-2xl border border-black/6 bg-white p-6">
        <EventPageActions title={data.title} />

        <h1 className="mt-3 text-2xl font-bold">{data.title}</h1>
        <p className="mt-1 text-sm text-black/70">{formatEventDate(data.date)}</p>

        {data.city ? (
          <p className="mt-1 text-sm text-black/60">
            <Link
              href={`/events/${cityLabelToSlug(data.city)}`}
              className="underline underline-offset-2 hover:text-neo-teal transition-colors"
            >
              {data.city}
            </Link>
            {data.venue ? ` · ${data.venue}` : null}
          </p>
        ) : null}

        {data.status === "ended" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Cet événement est terminé.
          </div>
        ) : data.status === "cancelled" ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Cet événement a été annulé.
          </div>
        ) : null}

        {data.image_url ? (
          <Image
            src={data.image_url}
            alt={`Affiche de l'evenement ${data.title}`}
            width={1400}
            height={800}
            className="mt-4 h-80 w-full rounded-xl object-contain bg-[#f5f5f5]"
            priority
          />
        ) : (
          <div className="mt-4 flex h-72 w-full items-center justify-center rounded-xl bg-[#f5f5f5] text-sm text-black/50">
            Pas d&apos;image
          </div>
        )}

        <p className="mt-4 whitespace-pre-line text-sm text-black/80">
          {data.description || "Description non renseignée."}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/6 bg-gradient-to-br from-neo-teal/[0.03] to-neo-green/[0.03] px-4 py-3">
          <div>
            {finalPrice < officialPrice ? (
              <>
                <p className="text-xs text-black/50 line-through">{formatMoney(officialPrice)}</p>
                {organizerDiscountPercent > 0 ? (
                  <p className="mt-1 text-xs font-medium text-neo-teal">
                    -{organizerDiscountPercent}% de remise organisateur
                  </p>
                ) : null}
                {platformDiscountPercent > 0 ? (
                  <p className="mt-0.5 text-xs font-medium text-blue-700">
                    -{platformDiscountPercent}% de remise plateforme OFFERTE
                  </p>
                ) : null}
                <p className="neo-price mt-1 text-xl">{formatMoney(finalPrice)}</p>
              </>
            ) : (
              <p className="text-xl font-bold">{formatMoney(finalPrice)}</p>
            )}
          </div>

          <BuyTicketButton
            eventId={data.id}
            finalPrice={finalPrice}
            eventDate={data.date}
            eventStatus={data.status}
          />
        </div>
      </section>
    </main>
  );
}
