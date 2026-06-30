"use client";

import Link from "next/link";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

export function WriteAccessGate({ children }: { children: React.ReactNode }) {
  const canWrite = useCanWriteBusinessData();

  if (canWrite) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6 py-12">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-zinc-900">閲覧のみの権限です</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          この画面での作成・編集はできません。必要な場合は管理者にお問い合わせください。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-zinc-900 hover:underline"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  );
}
