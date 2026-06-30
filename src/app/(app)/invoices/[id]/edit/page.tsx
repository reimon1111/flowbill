import { EditInvoiceClient } from "@/components/invoices/invoice-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditInvoiceEditPage() {
  return (
    <WriteAccessGate>
      <EditInvoiceClient />
    </WriteAccessGate>
  );
}
