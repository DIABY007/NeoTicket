import type { Metadata } from "next";

import { MainHomeShell } from "@/components/app/main-home-shell";
import { computeFinalPrice, computeOrganizerDiscountPercent, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

export const metadata: Metadata = {
  title: "NeoTicket — Billetterie en ligne au Burkina Faso | Paiement Orange Money",
  description:
    "Achetez vos billets pour concerts, festivals et soirées au Burkina Faso. Paiement sécurisé via Orange Money et réception de votre QR Code par WhatsApp.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NeoTicket — Billetterie en ligne au Burkina Faso",
    description:
      "Concerts, festivals, soirées : achetez vos billets via Orange Money et recevez votre QR Code par WhatsApp.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "NeoTicket — Billetterie en ligne Burkina Faso",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NeoTicket — Billetterie en ligne au Burkina Faso",
    description:
      "Concerts, festivals, soirées : achetez vos billets via Orange Money et recevez votre QR Code par WhatsApp.",
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

export default async function Home() {
  const supabase = getSupabaseServerClient();
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, description, date, end_date, price, official_price, organizer_price, city, image_url, status")
    .eq("status", "published")
    .order("date", { ascending: true })
    .returns<Omit<BuyerEvent, "platform_discount_percent" | "organizer_discount_percent" | "final_price">[]>();

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
            organizer_discount_percent: computeOrganizerDiscountPercent(officialPrice, organizerPrice),
            final_price: computeFinalPrice(organizerPrice, platformDiscountPercent),
          };
        });
  const feedError = error?.message ?? null;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NeoTicket",
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    description:
      "Billetterie en ligne au Burkina Faso. Paiement Orange Money et QR Code sur WhatsApp.",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+22656636039",
      contactType: "customer service",
      areaServed: "BF",
      availableLanguage: "French",
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "BF",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Comment acheter un billet sur NeoTicket ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Choisissez votre événement, cliquez sur « Acheter », puis payez via Orange Money. Votre QR Code est envoyé instantanément par WhatsApp.",
        },
      },
      {
        "@type": "Question",
        name: "Comment payer avec Orange Money ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lors de l'achat, saisissez votre numéro Orange Money. Vous recevez une demande USSD sur votre téléphone. Validez avec votre code secret et le paiement est confirmé.",
        },
      },
      {
        "@type": "Question",
        name: "Comment recevoir mon billet QR Code ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Après confirmation du paiement, votre billet avec QR Code est envoyé automatiquement sur WhatsApp. Présentez-le à l'entrée de l'événement.",
        },
      },
      {
        "@type": "Question",
        name: "Quels types d'événements sont disponibles ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Concerts, festivals, soirées, spectacles et autres événements au Burkina Faso. Tous les événements sont publiés par des organisateurs vérifiés.",
        },
      },
    ],
  };

  return (
    <main className="min-h-screen px-4 py-4 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h1 className="sr-only">
        NeoTicket — Billetterie en ligne au Burkina Faso
      </h1>
      <MainHomeShell events={events} feedError={feedError} />
    </main>
  );
}
