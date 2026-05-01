"use client";

const KEY = "mermaid-studio:recent";
const LIMIT = 5;

export type RecentDiagram = { id: string; title: string; ts: number };

export function recordRecent(id: string, title: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    const list: RecentDiagram[] = raw ? JSON.parse(raw) : [];
    const next = [
      { id, title, ts: Date.now() },
      ...list.filter((r) => r.id !== id),
    ].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("mermaid-recent-updated"));
  } catch {
    /* ignore quota errors */
  }
}

export function readRecent(): RecentDiagram[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentDiagram[]) : [];
  } catch {
    return [];
  }
}

export function clearRecent() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("mermaid-recent-updated"));
}
