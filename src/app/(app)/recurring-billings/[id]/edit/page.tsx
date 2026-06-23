import { EditRecurringClient } from "@/components/recurring/recurring-edit";

export default async function EditRecurringBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditRecurringClient recurringId={id} />;
}
