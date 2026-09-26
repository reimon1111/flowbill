/**
 * 会社の業務フロー設定（標準 / 簡易）。
 * companies.workflow_mode と対応。
 */
export const WORKFLOW_MODES = ["standard", "simple"] as const;

export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

export const DEFAULT_WORKFLOW_MODE: WorkflowMode = "standard";

export function normalizeWorkflowMode(
  value: string | null | undefined
): WorkflowMode {
  return value === "simple" ? "simple" : "standard";
}

export const WORKFLOW_MODE_OPTIONS: Array<{
  value: WorkflowMode;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "標準モード",
    description:
      "案件の進行状況に合わせて帳票を作成します。",
  },
  {
    value: "simple",
    label: "簡易モード",
    description:
      "案件作成時に見積・注文・納品・請求・領収を自動で用意します。",
  },
];

/** 会社設定用の補足（新規案件のデフォルトであることの説明） */
export const WORKFLOW_MODE_SETTINGS_HINT =
  "この設定は新しく作成する案件に適用されます。既存案件のモードは変更されません。";

export function isSimpleWorkflowMode(
  value: WorkflowMode | string | null | undefined
): boolean {
  return normalizeWorkflowMode(value) === "simple";
}
