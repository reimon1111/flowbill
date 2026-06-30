export type ActivityLogAction =
  | "created"
  | "updated"
  | "deleted"
  | "issued"
  | "paid"
  | "invited"
  | "member_removed";

export type ActivityLogTargetType =
  | "project"
  | "customer"
  | "item_template"
  | "quote"
  | "order"
  | "delivery_note"
  | "invoice"
  | "receipt"
  | "member"
  | "invitation";

export type ActivityLogRecord = {
  id: string;
  companyId: string;
  actorUserId: string | null;
  action: ActivityLogAction;
  targetType: ActivityLogTargetType;
  targetId: string;
  targetLabel: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ActivityLogInsert = {
  action: ActivityLogAction;
  targetType: ActivityLogTargetType;
  targetId: string;
  targetLabel: string;
  description: string;
  metadata?: Record<string, unknown>;
};
