import { AuthGate } from "@/components/auth/auth-gate";
import { ContractGate } from "@/components/auth/contract-gate";
import { AppInit } from "@/components/layout/app-init";
import { DataReadyGate } from "@/components/layout/data-ready-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AppInit />
      <DataReadyGate>
        <ContractGate>
          <AppShell>{children}</AppShell>
        </ContractGate>
      </DataReadyGate>
      <Toaster />
    </AuthGate>
  );
}
