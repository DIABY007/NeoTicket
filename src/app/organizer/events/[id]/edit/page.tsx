import { EventManagementTabs } from "@/components/organizer/event-management-tabs";

export default async function OrganizerEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-28">
      <section className="mx-auto w-full max-w-2xl">
        <h1 className="text-xl font-semibold sm:text-2xl">Gestion de l&apos;evenement</h1>
        <p className="mt-2 text-sm text-black/70">
          Modifiez les informations ou gerez le marketing de votre evenement.
        </p>

        <div className="mt-4 sm:mt-6">
          <EventManagementTabs eventId={id} />
        </div>
      </section>
    </main>
  );
}
