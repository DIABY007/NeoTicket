"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { buildEventSlug } from "@/lib/event-slug";

type BuyerEvent = {
  id: string;
  slug?: string;
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

function formatMoney(amount: number) {
  if (Math.round(amount) <= 0) {
    return "Gratuit";
  }
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

function formatDateBadge(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString("fr-FR", { month: "short" }).toUpperCase().replace(".", "");
  return { day, month };
}

/* ── Inline SVG icons ── */
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type QuickFilter = { label: string; type: "date" | "city"; value: string };

function getQuickFilters(cities: string[]): QuickFilter[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Find next Saturday & Sunday
  const daysUntilSat = (6 - today.getDay() + 7) % 7 || 7;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  const filters: QuickFilter[] = [
    { label: "Aujourd'hui", type: "date", value: todayStr },
    { label: "Ce week-end", type: "date", value: `${sat.toISOString().slice(0, 10)}..${sun.toISOString().slice(0, 10)}` },
  ];

  const priorityCities = ["Ouagadougou", "Bobo-Dioulasso"];
  for (const c of priorityCities) {
    if (cities.some((city) => city.toLowerCase() === c.toLowerCase())) {
      filters.push({ label: c, type: "city", value: c });
    }
  }

  // Add remaining cities (up to 3 more)
  for (const c of cities) {
    if (filters.length >= 6) break;
    if (!priorityCities.some((pc) => pc.toLowerCase() === c.toLowerCase())) {
      filters.push({ label: c, type: "city", value: c });
    }
  }

  return filters;
}

export function EventCatalog({ events }: { events: BuyerEvent[] }) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close bottom sheet on Escape
  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [filtersOpen]);

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (filtersOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [filtersOpen]);

  const cities = useMemo(() => {
    const values = events
      .map((event) => (event.city ?? "").trim())
      .filter((city) => city.length > 0);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "fr"));
  }, [events]);

  const quickFilters = useMemo(() => getQuickFilters(cities), [cities]);

  const hasActiveFilters = cityFilter !== "all" || dateFilter !== "" || maxPriceFilter !== "";

  const handleQuickFilter = (qf: QuickFilter) => {
    const key = `${qf.type}:${qf.value}`;
    if (activeQuickFilter === key) {
      // Toggle off
      setActiveQuickFilter(null);
      if (qf.type === "city") setCityFilter("all");
      if (qf.type === "date") setDateFilter("");
      return;
    }
    setActiveQuickFilter(key);
    if (qf.type === "city") {
      setCityFilter(qf.value);
      setDateFilter("");
    } else if (qf.type === "date") {
      setDateFilter(qf.value);
      setCityFilter("all");
    }
  };

  const clearFilters = () => {
    setCityFilter("all");
    setDateFilter("");
    setMaxPriceFilter("");
    setActiveQuickFilter(null);
  };

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const maxPrice = maxPriceFilter ? Number.parseInt(maxPriceFilter, 10) : null;

    return events.filter((event) => {
      const eventDate = new Date(event.date);
      const eventDateStr = eventDate.toISOString().slice(0, 10);

      // Date filter: single date or range (weekend)
      let dateMatches = true;
      if (dateFilter) {
        if (dateFilter.includes("..")) {
          const [start, end] = dateFilter.split("..");
          dateMatches = eventDateStr >= start && eventDateStr <= end;
        } else {
          dateMatches = eventDateStr === dateFilter;
        }
      }

      const cityMatches =
        cityFilter === "all" ||
        (event.city ?? "").trim().toLowerCase() === cityFilter.toLowerCase();

      const priceMatches = !Number.isFinite(maxPrice ?? NaN) || event.final_price <= (maxPrice as number);

      if (!normalizedSearch) {
        return dateMatches && cityMatches && priceMatches;
      }

      const searchable = [
        event.title,
        event.description ?? "",
        event.city ?? "",
        String(event.final_price),
        formatMoney(event.final_price),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch) && dateMatches && cityMatches && priceMatches;
    });
  }, [events, search, cityFilter, dateFilter, maxPriceFilter]);

  if (events.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl border border-black/6 bg-white p-10">
        <p className="text-lg font-bold text-black/80">Aucun evenement pour le moment</p>
        <p className="mt-1 text-sm text-black/50">Revenez bientot pour decouvrir de nouveaux evenements.</p>
      </section>
    );
  }

  return (
    <section>
      {/* ── Search bar + filter button ── */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Rechercher un evenement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-black/8 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-black/40 focus:border-neo-teal/40 focus:ring-2 focus:ring-neo-teal/10 transition"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition ${
            hasActiveFilters
              ? "border-neo-teal neo-gradient text-white"
              : "border-black/8 bg-white text-black/60 hover:border-neo-teal/30"
          }`}
          aria-label="Filtres"
        >
          <IconSliders />
          {hasActiveFilters ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full neo-gradient" />
          ) : null}
        </button>
      </div>

      {/* ── Quick-filter pills ── */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {quickFilters.map((qf) => {
          const key = `${qf.type}:${qf.value}`;
          const isActive = activeQuickFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickFilter(qf)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "neo-gradient text-white"
                  : "bg-white text-black/70 border border-black/8 hover:border-neo-teal/25"
              }`}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter bottom sheet ── */}
      {filtersOpen ? (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 bg-black/40"
          onClick={(e) => {
            if (e.target === backdropRef.current) setFiltersOpen(false);
          }}
        >
          <div
            className="absolute inset-x-0 bottom-0 animate-[slide-up_0.25s_ease-out] rounded-t-2xl bg-white px-5 pb-8 pt-4 shadow-xl"
            style={{ maxHeight: "70vh" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Filtres</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-black/40 transition hover:text-black"
                aria-label="Fermer les filtres"
              >
                <IconClose />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-black/80">Date</span>
                <input
                  type="date"
                  value={dateFilter.includes("..") ? "" : dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setActiveQuickFilter(null);
                  }}
                  className="neo-input rounded-xl px-3 py-2.5"
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-black/80">Ville</span>
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value);
                    setActiveQuickFilter(null);
                  }}
                  className="neo-input rounded-xl px-3 py-2.5"
                >
                  <option value="all">Toutes les villes</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-black/80">Prix max (FCFA)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ex: 10 000"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value)}
                  className="neo-input rounded-xl px-3 py-2.5"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setFiltersOpen(false);
                }}
                  className="flex-1 rounded-xl border border-black/8 py-2.5 text-sm font-medium transition hover:border-neo-teal/30 hover:text-neo-teal"
              >
                Reinitialiser
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                  className="neo-btn flex-1 rounded-xl py-2.5 text-sm"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Results ── */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-black/6 bg-white px-4 py-8 text-center">
          <p className="text-sm text-black/50">Aucun evenement ne correspond a votre recherche.</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs font-medium text-black/70 underline underline-offset-2"
            >
              Effacer les filtres
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Event cards grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event, eventIndex) => {
          const { day, month } = formatDateBadge(event.date);
          const hasDiscount = event.final_price < event.official_price;
          const totalDiscountPercent = hasDiscount
            ? Math.round(((event.official_price - event.final_price) / event.official_price) * 100)
            : 0;

          return (
            <Link
              key={event.id}
              href={`/e/${event.slug ?? buildEventSlug(event)}`}
              className="group block overflow-hidden rounded-2xl border border-black/6 bg-white transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:border-neo-teal/20"
            >
              {/* Image container with fixed aspect ratio */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#f0eeeb]">
                {event.image_url ? (
                  <Image
                    src={event.image_url}
                    alt={`Affiche de l'evenement ${event.title}`}
                    fill
                    priority={eventIndex === 0}
                    fetchPriority={eventIndex === 0 ? "high" : undefined}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-black/40">
                    Pas d&apos;image
                  </div>
                )}

                {/* Date badge */}
                <div className="absolute left-2.5 top-2.5 flex flex-col items-center rounded-lg bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                  <span className="text-base font-bold leading-none text-black">{day}</span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase leading-none text-black/60">{month}</span>
                </div>

                {/* Discount badge (top-right, only when discount exists) */}
                {hasDiscount && totalDiscountPercent > 0 ? (
                  <div className="absolute right-2.5 top-2.5 rounded-full neo-gradient px-2 py-1 shadow-sm">
                    <span className="text-[11px] font-bold text-white">-{totalDiscountPercent}%</span>
                  </div>
                ) : null}
              </div>

              {/* Card body */}
              <div className="px-3 pb-3 pt-2.5">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-black">
                  {event.title}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-black/50">
                  <IconMapPin />
                  <span className="text-xs">{event.city || "Ville non precisee"}</span>
                </div>

                {/* Price section */}
                <div className="mt-2.5 flex items-end justify-between">
                  {hasDiscount ? (
                    <div>
                      <p className="text-xs text-black/40 line-through">{formatMoney(event.official_price)}</p>
                      {event.organizer_discount_percent > 0 ? (
                        <p className="text-[11px] font-medium text-neo-teal">
                          -{event.organizer_discount_percent}% remise organisateur
                        </p>
                      ) : null}
                      {event.platform_discount_percent > 0 ? (
                        <p className="text-[11px] font-medium text-blue-700">
                          -{event.platform_discount_percent}% plateforme OFFERTE
                        </p>
                      ) : null}
                      <p className="neo-price mt-0.5 text-lg">{formatMoney(event.final_price)}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-black">{formatMoney(event.final_price)}</p>
                  )}

                  <span className="rounded-lg border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/70">
                    {Math.round(event.final_price) <= 0 ? "Recuperer ticket gratuit" : "Acheter ticket"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
