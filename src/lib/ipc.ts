import { invoke } from "@tauri-apps/api/core";
import type { ClipboardItem, SearchFilters, Settings } from "../types";

export async function getHistory(limit = 100, offset = 0): Promise<ClipboardItem[]> {
  return invoke("get_history", { limit, offset });
}

export async function search(
  query: string,
  filters: SearchFilters,
  limit = 100
): Promise<ClipboardItem[]> {
  return invoke("search", { query, filters, limit });
}

export async function copyToClipboard(id: number): Promise<void> {
  return invoke("copy_to_clipboard", { id });
}

export async function setFavorite(id: number, isFavorite: boolean): Promise<void> {
  return invoke("set_favorite", { id, isFavorite });
}

export async function deleteItem(id: number): Promise<void> {
  return invoke("delete_item", { id });
}

export async function getSettings(): Promise<Settings> {
  return invoke("get_settings");
}

export async function updateSettings(settings: Settings): Promise<void> {
  return invoke("update_settings", { settings });
}

export async function getExclusions(): Promise<string[]> {
  return invoke("get_exclusions");
}

export async function addExclusion(appName: string): Promise<void> {
  return invoke("add_exclusion", { appName });
}

export async function removeExclusion(appName: string): Promise<void> {
  return invoke("remove_exclusion", { appName });
}

export async function getImageData(imagePath: string): Promise<number[]> {
  return invoke("get_image_data", { imagePath });
}
