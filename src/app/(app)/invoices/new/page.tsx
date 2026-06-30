import { Suspense } from "react";
import { NewInvoiceClient } from "@/components/invoices/invoice-new";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function NewInvoicePage() {
  return (
    <WriteAccessGate>
      <Suspense>
        <NewInvoiceClient />
      </Suspense>
    </WriteAccessGate>
  );
}
