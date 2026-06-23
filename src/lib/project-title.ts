/** 題名1行分（項目名 + 金額） */
export type ProjectTitleLine = {
  label: string;
  amount: number;
};

const TOTAL_LINE_RE = /^合計\s*([¥￥]?)([\d,]+)\s*円?\s*$/i;
const ITEM_LINE_RE = /^(.+?)[\s　]+([¥￥]?)([\d,]+)\s*円?\s*$/;

function parseYenAmount(raw: string): number {
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** 題名テキストを解析（合計行は明細に含めない） */
export function parseProjectTitle(text: string): {
  lines: ProjectTitleLine[];
  total: number;
  hasTotalLine: boolean;
} {
  const rawLines = text.split(/\r?\n/);
  const lines: ProjectTitleLine[] = [];
  let hasTotalLine = false;
  let totalFromLine: number | null = null;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    const totalMatch = line.match(TOTAL_LINE_RE);
    if (totalMatch) {
      hasTotalLine = true;
      totalFromLine = parseYenAmount(totalMatch[2]);
      continue;
    }

    const itemMatch = line.match(ITEM_LINE_RE);
    if (itemMatch) {
      const label = itemMatch[1].trim();
      const amount = parseYenAmount(itemMatch[3]);
      if (label) lines.push({ label, amount });
      continue;
    }

    lines.push({ label: line, amount: 0 });
  }

  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const total =
    lines.length > 0
      ? sum
      : hasTotalLine && totalFromLine != null
        ? totalFromLine
        : 0;

  return { lines, total, hasTotalLine };
}

/** 金額を題名用表記に（例: 10000 → 10000円） */
export function formatTitleAmount(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 明細行 + 合計行の題名に整形 */
export function normalizeProjectTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const { lines } = parseProjectTitle(trimmed);
  const itemLines = lines.filter((l) => l.label && l.amount > 0);

  if (itemLines.length === 0) {
    return trimmed;
  }

  const body = itemLines
    .map((l) => `${l.label} ${formatTitleAmount(l.amount)}`)
    .join("\n");
  const total = itemLines.reduce((s, l) => s + l.amount, 0);
  return `${body}\n合計${formatTitleAmount(total)}`;
}

/** 一覧表示用（先頭行） */
export function getProjectTitleHeadline(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? (text.trim() || "（無題）");
}

/** 見積下書き用の明細行 */
export function quoteItemsFromProjectTitle(
  projectName: string,
  fallbackAmount: number
): Array<{
  name: string;
  unitPrice: number;
}> {
  const { lines } = parseProjectTitle(projectName);
  const priced = lines.filter((l) => l.label && l.amount > 0);

  if (priced.length > 0) {
    return priced.map((l) => ({ name: l.label, unitPrice: l.amount }));
  }

  const amount = Math.max(0, fallbackAmount);
  if (amount > 0) {
    return [
      {
        name: getProjectTitleHeadline(projectName) || "見積明細",
        unitPrice: amount,
      },
    ];
  }

  return [{ name: "（品目を入力してください）", unitPrice: 0 }];
}
