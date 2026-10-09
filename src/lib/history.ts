import type { Appearance, ContentType, Fields } from "./qr";

export interface HistoryItem {
  id: string;
  type: ContentType;
  fields: Fields;
  appearance: Appearance;
  payload: string;
  ts: number;
}

const KEY = "qrstudio:history";
export const HISTORY_LIMIT = 20;

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
