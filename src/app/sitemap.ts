import type { MetadataRoute } from "next";

import { buildEventSlug, cityLabelToSlug } from "@/lib/event-slug";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventSitemapRow = {
  id: string;
  slug: string | null;
  title: string;
  city: string | null;
  date: string;
  updated_at: string | null;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/events`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, slug, title, city, date, updated_at")
      .in("status", ["published", "ended"])
      .order("date", { ascending: false })
      .returns<EventSitemapRow[]>();

    if (error || !data) {
      return staticRoutes;
    }

    const eventRoutes: MetadataRoute.Sitemap = data.map((event) => ({
      url: `${siteUrl}/e/${event.slug || buildEventSlug(event)}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const cityRoutes: MetadataRoute.Sitemap = Array.from(
      new Set(data.map((event) => cityLabelToSlug(event.city ?? "")).filter(Boolean)),
    ).map((citySlug) => ({
      url: `${siteUrl}/events/${citySlug}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...cityRoutes, ...eventRoutes];
  } catch {
    return staticRoutes;
  }
}
