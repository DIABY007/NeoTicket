export type EventSlugInput = {
  id: string;
  title: string;
  city: string | null;
  date: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeEventSlug(value: string) {
  return slugify(value).slice(0, 120);
}

export function buildMarketingSlug(input: {
  title: string;
  city: string | null;
  date: string;
}) {
  const year = new Date(input.date).getFullYear();
  const titlePart = normalizeEventSlug(input.title) || "evenement";
  const cityPart = normalizeEventSlug(input.city ?? "burkina-faso") || "burkina-faso";
  return normalizeEventSlug(`${titlePart}-${cityPart}-${year}`) || "evenement";
}

export function buildEventSlug(input: EventSlugInput) {
  const year = new Date(input.date).getFullYear();
  const titlePart = slugify(input.title) || "evenement";
  const cityPart = slugify(input.city ?? "burkina-faso") || "burkina-faso";
  return `${titlePart}-${cityPart}-${year}--${input.id}`;
}

export function citySlugToLabel(citySlug: string) {
  return citySlug
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function cityLabelToSlug(city: string) {
  return slugify(city);
}
