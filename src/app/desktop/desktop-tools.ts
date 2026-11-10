import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export const ISLAND_WINDOW = "screen-island";
export const PET_WINDOW = "desktop-pet";

export type NoteKind = "study" | "code";
export type NotebookInfo = { directory: string; screenPermission: boolean };
export type PetStatus = { modelPath: string | null; visible: boolean; source: "local" | "account" | null };
export type AccountPetChoice = { id: string; name: string; current: boolean };
export type PetModel = { url: string; motion: string | null };
export type ScreenResult = { status: "captured"; text: string | null; preview: string }
  | { status: "cancelled" } | { status: "permissionRequired" };

export const desktopToolsAvailable = () => isTauri() && /mac/i.test(navigator.platform);
export const desktopToolWindow = () => isTauri() ? getCurrentWebviewWindow().label : "";
export const desktopToolError = (error: unknown) => typeof error === "string" ? error : "桌面操作失败，请重试。";

export const desktopTools = {
  island: () => invoke<void>("desktop_island_open"),
  expandIsland: (expanded: boolean) => invoke<void>("desktop_island_expand", { expanded }),
  close: (label: string) => invoke<void>("desktop_overlay_close", { label }),
  notebook: () => invoke<NotebookInfo>("screen_notebook_info"),
  permissionSettings: () => invoke<void>("screen_permission_settings"),
  capture: () => invoke<ScreenResult>("screen_select_text"),
  saveNote: (kind: NoteKind, title: string, body: string) => invoke<string>("screen_note_save", { kind, title, body }),
  openNotes: () => invoke<void>("screen_notes_open"),
  toChat: (kind: NoteKind, body: string) => invoke<void>("screen_note_to_chat", { kind, body }),
  petStatus: () => invoke<PetStatus>("desktop_pet_status"),
  importPet: (path: string) => invoke<string>("desktop_pet_import", { path }),
  showPet: () => invoke<void>("desktop_pet_open"),
  accountPets: () => invoke<AccountPetChoice[]>("account_pet_models"),
  showAccountPet: (id?: string) => invoke<void>("account_pet_open", { id: id ?? null }),
  uploadPet: (path: string) => invoke<string>("account_pet_upload", { path }),
  bindPet: (resource: string, name: string) => invoke<void>("account_pet_bind", { resource, name }),
  petModel: () => invoke<PetModel>("desktop_pet_model"),
};
