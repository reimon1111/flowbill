/** 作成・更新の監査メタデータ（詳細画面表示用） */
export type AuditMetadata = {
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditMetadataInput = Pick<
  AuditMetadata,
  "createdBy" | "updatedBy"
>;
