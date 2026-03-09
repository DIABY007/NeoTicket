import Image from "next/image";
import Link from "next/link";

import { BuyTicketButton } from "@/components/buyer/buy-ticket-button";
import { EventPageActions } from "@/components/buyer/event-page-actions";
import { computeFinalPrice, computeOrganizerDiscountPercent, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  price: number;
  official_price: number;
  organizer_price: number;
  image_url: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailsPage({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, date, end_date, price, official_price, organizer_price, image_url, status")
    .eq("id", id)
    .maybeSingle<EventDetail>();

  if (error || !data) {
    return (
      <main className="min-h-screen px-4 py-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-black/6 bg-white p-6">
          <h1 className="text-2xl font-bold">Evenement introuvable</h1>
          <p className="mt-2 text-sm text-black/70">
            L&apos;evenement demande n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <Link href="/" className="neo-btn mt-4 inline-block rounded-xl px-4 py-2 text-sm">
            Retour au feed
          </Link>
        </section>
      </main>
    );
  }

  const officialPrice = Number(data.official_price ?? data.price);
  const organizerPrice = Number(data.organizer_price ?? data.price);
  const organizerDiscountPercent = computeOrganizerDiscountPercent(officialPrice, organizerPrice);
  const finalPrice = computeFinalPrice(organizerPrice, platformDiscountPercent);

  return (
    <main className="min-h-screen px-4 py-6">
      <section className="mx-auto max-w-3xl rounded-2xl border border-black/6 bg-white p-6">
        <EventPageActions title={data.title} />

        <h1 className="mt-3 text-2xl font-bold">{data.title}</h1>
        <p className="mt-1 text-sm text-black/70">
          {new Date(data.date).toLocaleString("fr-FR", {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>

        {data.image_url ? (
          <Image
            src={data.image_url}
            alt={`Affiche ${data.title}`}
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
          {data.description || "Description non renseignee."}
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
