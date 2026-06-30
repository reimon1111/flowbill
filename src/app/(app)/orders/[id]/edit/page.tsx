import { CommercialDocumentEditClient } from "@/components/shared/commercial-document-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditOrderPage() {
  return (
    <WriteAccessGate>
      <CommercialDocumentEditClient kind="order" />
    </WriteAccessGate>
  );
}
