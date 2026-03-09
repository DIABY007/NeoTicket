type Props = {
  searchParams: Promise<{ phone?: string }>;
};

export default async function BuyerPaymentPendingPage({ searchParams }: Props) {
  const params = await searchParams;
  const supportPhone = params.phone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+22656636039";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Paiement en cours de traitement...</h1>
        <p className="mt-3 text-sm text-black/70">
          Merci. Votre transaction est en cours de verification manuelle. Votre ticket sera envoye sur WhatsApp apres validation.
        </p>

        <a
          href={`tel:${supportPhone}`}
          className="mt-6 inline-block rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
        >
          Appeler le support en cas de besoin
        </a>
      </section>
    </main>
  );
}
