import { CommercialDocumentEditClient } from "@/components/shared/commercial-document-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditReceiptPage() {
  return (
    <WriteAccessGate>
      <CommercialDocumentEditClient kind="receipt" />
    </WriteAccessGate>
  );
}
