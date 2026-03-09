import { EventCatalog } from "@/components/buyer/event-catalog";
import { computeFinalPrice, computeOrganizerDiscountPercent, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function BuyerPage() {
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

  return (
    <main className="min-h-screen p-6">
      <EventCatalog events={events} />
    </main>
  );
}
