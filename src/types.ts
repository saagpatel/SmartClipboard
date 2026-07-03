export interface ClipboardItem {
  id: number;
  content: string;
  contentType: "text" | "image";
  imagePath: string | null;
  category: Category;
  sourceApp: string;
  preview: string;
  copiedAt: number;
  isFavorite: boolean;
  isSensitive: boolean;
  hash: string;
}

export type Category = "url" | "email" | "error" | "code" | "command" | "ip" | "path" | "misc";

export interface SearchFilters {
  category?: Category;
  dateFrom?: number;
  dateTo?: number;
  sourceApp?: string;
  contentType?: "text" | "image";
}

export interface Settings {
  retentionDays: number;
  maxItems: number;
  keyboardShortcut: string;
  autoExcludeSensitive: boolean;
  maxImageSizeMb: number;
}
