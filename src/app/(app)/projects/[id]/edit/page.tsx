import { EditProjectClient } from "@/components/projects/project-edit";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default function EditProjectPage() {
  return (
    <WriteAccessGate>
      <EditProjectClient />
    </WriteAccessGate>
  );
}
