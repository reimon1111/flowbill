"use client";

import { useId, useMemo } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  label,
  description,
  value,
  onChange,
  recommended,
  highlight,
}: {
  label: string;
  description: string;
  value: string | null;
  onChange: (next: string | null) => void;
  recommended?: string;
  highlight?: boolean;
}) {
  const inputId = useId();
  const has = !!value;
  const hint = useMemo(
    () => (recommended ? `推奨: ${recommended}` : undefined),
    [recommended]
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm shadow-zinc-900/[0.02]",
        highlight ? "border-amber-200/80" : "border-zinc-200/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{label}</p>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
          {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
        </div>
        {has && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
            aria-label={`${label}を削除`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-4">
        <label
          htmlFor={inputId}
          className={cn(
            "group flex cursor-pointer items-center justify-center rounded-xl border border-dashed bg-zinc-50/30 px-4 py-6 transition-colors hover:bg-zinc-50",
            highlight ? "border-amber-200" : "border-zinc-200"
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${label}プレビュー`}
              className={cn(
                "max-h-28 w-auto rounded-lg object-contain",
                label === "会社印" ? "max-h-32" : ""
              )}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100">
                <ImageIcon className="size-6" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="size-4" />
                画像をアップロード
              </div>
              <p className="text-xs text-zinc-400">
                PNG推奨（背景透過OK）/ リロードで消えてOK
              </p>
            </div>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              onChange(typeof result === "string" ? result : null);
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </div>
  );
}

