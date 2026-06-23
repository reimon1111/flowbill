import { NewQuoteClient } from "@/components/quotes/quote-new";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  return <NewQuoteClient projectId={projectId} />;
}
