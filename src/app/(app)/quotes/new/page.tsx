import { NewQuoteClient } from "@/components/quotes/quote-new";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  return (
    <WriteAccessGate>
      <NewQuoteClient projectId={projectId} />
    </WriteAccessGate>
  );
}
