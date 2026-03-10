import { CreateEventForm } from "@/components/organizer/create-event-form";
import { resolvePlatformDiscountPercent } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrganizerCreateEventPage() {
  const platformDiscountPercent = await resolvePlatformDiscountPercent();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-28">
      <h1 className="text-xl font-semibold sm:text-2xl">Publier un evenement</h1>
      <p className="mt-1 text-sm text-black/50">
        En quelques secondes, votre evenement est en ligne.
      </p>

      <div className="mt-5">
        <CreateEventForm platformDiscountPercent={platformDiscountPercent} />
      </div>
    </main>
  );
}