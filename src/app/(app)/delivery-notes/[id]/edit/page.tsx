import { CommercialDocumentEditClient } from "@/components/shared/commercial-document-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditDeliveryNotePage() {
  return (
    <WriteAccessGate>
      <CommercialDocumentEditClient kind="delivery_note" />
    </WriteAccessGate>
  );
}
