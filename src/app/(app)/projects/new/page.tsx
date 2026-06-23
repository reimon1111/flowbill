import { NewProjectClient } from "@/components/projects/project-new";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  return <NewProjectClient initialCustomerId={customerId} />;
}
