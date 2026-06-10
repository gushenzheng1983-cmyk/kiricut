import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/userPreferences";

const SYNC_VERSION = 1;

export type SettingsExportBundle = {
  version: number;
  exportedAt: string;
  preferences: UserPreferences;
};

export function exportSettingsBundle(): SettingsExportBundle {
  return {
    version: SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: loadPreferences(),
  };
}

export function downloadSettingsBundle(): void {
  const bundle = exportSettingsBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kiricut-settings-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importSettingsFromFile(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<SettingsExportBundle>;
  if (!parsed.preferences || typeof parsed.preferences !== "object") {
    throw new Error("Invalid settings file");
  }
  savePreferences(parsed.preferences);
}
