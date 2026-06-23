"use client";

import { useCallback, useState } from "react";

/** 検索・絞り込み・並び替え変更時に1ページ目へ戻す */
export function useListPage(...resetDeps: unknown[]) {
  const resetKey = JSON.stringify(resetDeps);
  const [pageState, setPageState] = useState({ resetKey, page: 1 });

  const page = pageState.resetKey === resetKey ? pageState.page : 1;

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState({ resetKey, page: nextPage });
    },
    [resetKey]
  );

  return { page, setPage };
}
