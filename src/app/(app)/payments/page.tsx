import { Suspense } from "react";
import { PaymentList } from "@/components/payments/payment-list";

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentList />
    </Suspense>
  );
}
