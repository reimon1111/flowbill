export type SettingsSectionSaveResult =
  | { ok: true }
  | { ok: false; reason: "validation" | "permission" | "error"; message: string };

export type SettingsSectionHandle = {
  save: () => Promise<SettingsSectionSaveResult>;
};
