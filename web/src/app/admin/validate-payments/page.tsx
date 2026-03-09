import { ValidatePaymentsPanel } from "@/components/admin/validate-payments-panel";
import { requireAdminServerSession } from "@/lib/auth/admin-guard";

export default async function ValidatePaymentsPage() {
  await requireAdminServerSession();

  return (
    <main className="min-h-screen p-6">
      <ValidatePaymentsPanel />
    </main>
  );
}
