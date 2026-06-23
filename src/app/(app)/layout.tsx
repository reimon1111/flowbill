import { AuthGate } from "@/components/auth/auth-gate";
import { AppInit } from "@/components/layout/app-init";
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
      <AppShell>{children}</AppShell>
      <Toaster />
    </AuthGate>
  );
}
