import { Suspense } from "react";
import { NewInvoiceClient } from "@/components/invoices/invoice-new";

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceClient />
    </Suspense>
  );
}
