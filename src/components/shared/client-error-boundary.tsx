"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
};

type State = {
  hasError: boolean;
};

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ClientErrorBoundary", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-lg font-semibold text-zinc-900">
            {this.props.title ?? "画面の表示に失敗しました"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            通信状況を確認のうえ、再度お試しください。問題が続く場合は一覧から開き直してください。
          </p>
          {this.props.backHref ? (
            <Link
              href={this.props.backHref}
              className={cn(
                buttonVariants(),
                "mt-6 inline-flex rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              {this.props.backLabel ?? "一覧へ戻る"}
            </Link>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
