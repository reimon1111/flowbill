"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "flowbill:list-sort:";

const sortListeners = new Set<() => void>();

function subscribeSortStore(onStoreChange: () => void) {
  sortListeners.add(onStoreChange);
  return () => {
    sortListeners.delete(onStoreChange);
  };
}

function notifySortStoreChange() {
  sortListeners.forEach((listener) => listener());
}

function readStoredSort<T extends string>(
  listId: string,
  defaultSort: T,
  validValues: readonly T[]
): T {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${listId}`);
    if (stored && (validValues as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // localStorage 不可時はデフォルト
  }
  return defaultSort;
}

/** 一覧の並び替え — 最後に選んだ値を localStorage に保持 */
export function useListSort<T extends string>(
  listId: string,
  defaultSort: T,
  validValues: readonly T[]
): [T, (value: T) => void] {
  const sort = useSyncExternalStore(
    subscribeSortStore,
    () => readStoredSort(listId, defaultSort, validValues),
    () => defaultSort
  );

  const setSort = useCallback(
    (value: T) => {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${listId}`, value);
        notifySortStoreChange();
      } catch {
        // ignore
      }
    },
    [listId]
  );

  return [sort, setSort];
}
