"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
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
            {this.props.description ??
              "画面の表示中に問題が発生しました。しばらくしてから再度お試しください。"}
          </p>
          {process.env.NODE_ENV !== "production" && this.state.errorMessage ? (
            <p className="mt-3 break-all text-xs text-zinc-400">
              {this.state.errorMessage}
            </p>
          ) : null}
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
