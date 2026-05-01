import { create } from "zustand";
import type { CustomStyles } from "@/lib/validators";

export type MermaidTheme = "default" | "dark" | "forest" | "neutral" | "base";

export type DiagramState = {
  id: string | null;
  title: string;
  code: string;
  theme: MermaidTheme;
  customStyles: CustomStyles;
  customCss: string;
  tags: string[];
  isPublic: boolean;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
};

type DiagramActions = {
  hydrate: (d: Partial<DiagramState> & { id: string }) => void;
  setTitle: (t: string) => void;
  setCode: (c: string) => void;
  setTheme: (t: MermaidTheme) => void;
  setCustomStyles: (s: CustomStyles) => void;
  setCustomCss: (s: string) => void;
  setTags: (t: string[]) => void;
  setIsPublic: (p: boolean) => void;
  setSaving: (s: boolean) => void;
  markSaved: () => void;
  reset: () => void;
};

const initial: DiagramState = {
  id: null,
  title: "Untitled diagram",
  code: "",
  theme: "default",
  customStyles: {},
  customCss: "",
  tags: [],
  isPublic: false,
  dirty: false,
  saving: false,
  lastSavedAt: null,
};

export const useDiagramStore = create<DiagramState & DiagramActions>((set) => ({
  ...initial,
  hydrate: (d) =>
    set(() => ({
      ...initial,
      ...d,
      dirty: false,
      saving: false,
      lastSavedAt: Date.now(),
    })),
  setTitle: (t) => set({ title: t, dirty: true }),
  setCode: (c) => set({ code: c, dirty: true }),
  setTheme: (t) => set({ theme: t, dirty: true }),
  setCustomStyles: (s) => set({ customStyles: s, dirty: true }),
  setCustomCss: (s) => set({ customCss: s, dirty: true }),
  setTags: (t) => set({ tags: t, dirty: true }),
  setIsPublic: (p) => set({ isPublic: p }),
  setSaving: (s) => set({ saving: s }),
  markSaved: () => set({ dirty: false, saving: false, lastSavedAt: Date.now() }),
  reset: () => set({ ...initial }),
}));
