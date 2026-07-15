/**
 * 先方担当者（案件・各書類のスナップショット）。
 * 将来 customer_contacts マスタへ移行しやすい命名。
 */
export type CounterpartyContactFields = {
  customerContactName: string;
  customerDepartment: string;
  customerPosition: string;
};

export const EMPTY_COUNTERPARTY_CONTACT: CounterpartyContactFields = {
  customerContactName: "",
  customerDepartment: "",
  customerPosition: "",
};

export function normalizeCounterpartyContact(
  source?: Partial<CounterpartyContactFields> | null
): CounterpartyContactFields {
  return {
    customerContactName: source?.customerContactName?.trim() ?? "",
    customerDepartment: source?.customerDepartment?.trim() ?? "",
    customerPosition: source?.customerPosition?.trim() ?? "",
  };
}

export function pickCounterpartyContact(
  source?: Partial<CounterpartyContactFields> | null
): CounterpartyContactFields {
  return normalizeCounterpartyContact(source);
}

export function hasCounterpartyContactName(
  source?: Partial<CounterpartyContactFields> | null
): boolean {
  return Boolean(source?.customerContactName?.trim());
}
