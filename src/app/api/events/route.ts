import { NextResponse } from "next/server";

import { computeFinalPrice, computeOrganizerDiscountPercent, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
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
  image_url: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const platformDiscountPercent = await resolvePlatformDiscountPercent();

    const { data, error } = await supabase
      .from("events")
      .select("id, slug, title, description, date, end_date, price, official_price, organizer_price, city, image_url, status")
      .eq("status", "published")
      .order("date", { ascending: true })
      .returns<EventRow[]>();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Lecture des evenements impossible." },
        { status: 500 },
      );
    }

    const events = (data ?? []).map((event) => {
      const officialPrice = Number(event.official_price ?? event.price);
      const organizerPrice = Number(event.organizer_price ?? event.price);
      const finalPrice = computeFinalPrice(organizerPrice, platformDiscountPercent);

      return {
        ...event,
        official_price: officialPrice,
        organizer_price: organizerPrice,
        platform_discount_percent: platformDiscountPercent,
        organizer_discount_percent: computeOrganizerDiscountPercent(officialPrice, organizerPrice),
        final_price: finalPrice,
      };
    });

    return NextResponse.json({ success: true, events });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur inattendue sur le catalogue evenement." },
      { status: 500 },
    );
  }
}
