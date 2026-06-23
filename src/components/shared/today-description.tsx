"use client";

import { useSyncExternalStore } from "react";
import { formatTodayLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

type TodayDescriptionProps = {
  className?: string;
};

function subscribe() {
  return () => {};
}

function getTodaySnapshot() {
  return formatTodayLocal(new Date());
}

function getServerSnapshot() {
  return null;
}

/**
 * ハイドレーション不一致を避けるため、サーバーではプレースホルダー、
 * クライアントではローカル日付を表示する
 */
export function TodayDescription({ className }: TodayDescriptionProps) {
  const today = useSyncExternalStore(
    subscribe,
    getTodaySnapshot,
    getServerSnapshot
  );

  return (
    <p className={cn("text-base text-zinc-500", className)}>
      {today ?? <span className="invisible">0000年0月0日</span>}
    </p>
  );
}
