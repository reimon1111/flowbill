import { NewProjectClient } from "@/components/projects/project-new";
import { WriteAccessGate } from "@/components/auth/write-access-gate";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  return (
    <WriteAccessGate>
      <NewProjectClient initialCustomerId={customerId} />
    </WriteAccessGate>
  );
}
