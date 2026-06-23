"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Mail, Phone, User } from "lucide-react";
import type { Customer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

type CustomerComboboxProps = {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  error?: unknown;
};

export function CustomerCombobox({
  customers,
  value,
  onChange,
  error,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-zinc-700">
          顧客 <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200/80 bg-white px-3 text-left text-base transition-colors hover:border-zinc-300",
              error != null && error !== "" && "border-red-300",
              open && "border-zinc-400 ring-2 ring-zinc-200"
            )}
          >
            <span
              className={cn(
                "truncate",
                selected ? "text-zinc-900" : "text-zinc-400"
              )}
            >
              {selected ? selected.customerName : "顧客を検索・選択..."}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-lg shadow-zinc-900/10">
              <div className="border-b border-zinc-100 p-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="会社名・担当者で検索..."
                  className="h-9 rounded-lg border-zinc-200/80 text-sm"
                  autoFocus
                />
              </div>
              <ul className="max-h-56 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-zinc-500">
                    該当する顧客がありません
                  </li>
                ) : (
                  filtered.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-zinc-50",
                          value === customer.id && "bg-zinc-50"
                        )}
                        onClick={() => {
                          onChange(customer.id);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <Check
                          className={cn(
                            "size-4 shrink-0",
                            value === customer.id
                              ? "text-zinc-900"
                              : "invisible"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900">
                            {customer.customerName}
                          </p>
                          {customer.contactName && (
                            <p className="truncate text-xs text-zinc-500">
                              {customer.contactName}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
        {error != null && error !== "" && (
          <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
        )}
      </div>

      {selected && <CustomerPreviewCard customer={selected} />}
    </div>
  );
}

function CustomerPreviewCard({ customer }: { customer: Customer }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        選択中の顧客
      </p>
      <p className="mt-2 font-semibold text-zinc-900">
        {customer.customerName}
      </p>
      <div className="mt-3 space-y-2 text-sm text-zinc-600">
        {customer.contactName && (
          <div className="flex items-center gap-2">
            <User className="size-3.5 text-zinc-400" />
            {customer.contactName}
          </div>
        )}
        {customer.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 text-zinc-400" />
            {customer.email}
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-3.5 text-zinc-400" />
            {customer.phone}
          </div>
        )}
      </div>
    </div>
  );
}
