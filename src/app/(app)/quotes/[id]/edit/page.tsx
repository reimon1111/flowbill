import { EditQuoteClient } from "@/components/quotes/quote-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditQuotePage() {
  return (
    <WriteAccessGate>
      <EditQuoteClient />
    </WriteAccessGate>
  );
}
