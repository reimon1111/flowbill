import { formatCurrency } from "@/lib/format";
import { normalizeUnit } from "@/lib/constants/units";

export type DocumentLineItem = {
  id: string;
  name: string;
  description?: string;
  width?: string;
  height?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
};

export function DocumentItemsTable({ items }: { items: DocumentLineItem[] }) {
  return (
    <div className="document-items mt-3 overflow-x-auto">
      <table className="document-items-table w-full border-collapse border border-zinc-400 text-[11px] leading-tight text-zinc-800">
        <colgroup>
          <col className="w-auto" />
          <col className="w-[32px]" />
          <col className="w-[32px]" />
          <col className="w-[36px]" />
          <col className="w-[36px]" />
          <col className="w-[68px]" />
          <col className="w-[76px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-zinc-400 bg-zinc-50 text-[10px] text-zinc-700">
            <th className="border-r border-zinc-300 px-1 py-0.5 text-left font-medium">
              商品名／品目
            </th>
            <th className="border-r border-zinc-300 px-0.5 py-0.5 text-center font-medium">
              W
            </th>
            <th className="border-r border-zinc-300 px-0.5 py-0.5 text-center font-medium">
              H
            </th>
            <th className="border-r border-zinc-300 px-0.5 py-0.5 text-right font-medium">
              数量
            </th>
            <th className="border-r border-zinc-300 px-0.5 py-0.5 text-left font-medium">
              単位
            </th>
            <th className="border-r border-zinc-300 px-1 py-0.5 text-right font-medium">
              単価
            </th>
            <th className="px-1 py-0.5 text-right font-medium">金額</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="document-item-row border-b border-zinc-300 align-top"
            >
              <td className="border-r border-zinc-300 px-1 py-0.5">
                <span className="text-zinc-900">{item.name}</span>
                {item.description ? (
                  <span className="document-item-description ml-1 text-[10px] text-zinc-500">
                    {item.description}
                  </span>
                ) : null}
              </td>
              <td className="border-r border-zinc-300 px-0.5 py-0.5 text-center tabular-nums">
                {item.width || ""}
              </td>
              <td className="border-r border-zinc-300 px-0.5 py-0.5 text-center tabular-nums">
                {item.height || ""}
              </td>
              <td className="border-r border-zinc-300 px-0.5 py-0.5 text-right tabular-nums">
                {item.quantity}
              </td>
              <td className="border-r border-zinc-300 px-0.5 py-0.5">
                {normalizeUnit(item.unit)}
              </td>
              <td className="border-r border-zinc-300 px-1 py-0.5 text-right tabular-nums">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="px-1 py-0.5 text-right font-medium tabular-nums text-zinc-900">
                {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
