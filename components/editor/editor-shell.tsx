"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { CodeEditor } from "@/components/editor/monaco-editor";
import {
  MermaidPreview,
  exportSvg,
  type MermaidPreviewHandle,
} from "@/components/editor/mermaid-preview";
import { StylePanel } from "@/components/editor/style-panel";
import { useDiagramStore, type MermaidTheme } from "@/store/diagram-store";
import type { CustomStyles } from "@/lib/validators";
import { debounce } from "@/lib/utils";

export type DiagramApiPayload = {
  id: string;
  title: string;
  code: string;
  theme: MermaidTheme;
  customStyles: CustomStyles;
};

export function EditorShell({ initial }: { initial: DiagramApiPayload }) {
  const router = useRouter();
  const { toast } = useToast();
  const previewRef = React.useRef<MermaidPreviewHandle>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [debouncedCode, setDebouncedCode] = React.useState(initial.code);

  // Re-fit the preview whenever the layout dimensions change (e.g. fullscreen).
  React.useEffect(() => {
    const id = requestAnimationFrame(() => previewRef.current?.fitToView());
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);

  const {
    id,
    title,
    code,
    theme,
    customStyles,
    dirty,
    saving,
    lastSavedAt,
    hydrate,
    setTitle,
    setCode,
    setTheme,
    setCustomStyles,
    setSaving,
    markSaved,
  } = useDiagramStore();

  React.useEffect(() => {
    hydrate(initial);
  }, [initial, hydrate]);

  // Debounce the code for the preview (300ms).
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedCode(code), 300);
    return () => clearTimeout(t);
  }, [code]);

  const save = React.useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, code, theme, customStyles }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ variant: "destructive", title: "Save failed", description: data.error });
        setSaving(false);
        return;
      }
      markSaved();
    } catch (e) {
      setSaving(false);
      toast({ variant: "destructive", title: "Save failed" });
    }
  }, [id, title, code, theme, customStyles, setSaving, markSaved, toast]);

  // Auto-save debounce (1s after last change).
  const autoSaveRef = React.useRef(
    debounce(() => {
      void save();
    }, 1000),
  );
  React.useEffect(() => {
    autoSaveRef.current = debounce(() => {
      void save();
    }, 1000);
  }, [save]);

  React.useEffect(() => {
    if (dirty) autoSaveRef.current();
  }, [dirty, title, code, theme, customStyles]);

  // Cmd/Ctrl+S shortcut.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  function downloadSvg() {
    const svg = exportSvg(previewRef.current?.getSvg() ?? null);
    if (!svg) {
      toast({ variant: "destructive", title: "Nothing to export" });
      return;
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(blob, `${safeFilename(title)}.svg`);
  }

  async function downloadPng() {
    const svgEl = previewRef.current?.getSvg();
    if (!svgEl) {
      toast({ variant: "destructive", title: "Nothing to export" });
      return;
    }
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load SVG"));
        img.src = url;
      });
      const bbox = svgEl.getBoundingClientRect();
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D context");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({ variant: "destructive", title: "PNG export failed" });
          return;
        }
        triggerDownload(blob, `${safeFilename(title)}.png`);
      }, "image/png");
    } catch {
      toast({ variant: "destructive", title: "PNG export failed" });
    }
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex h-screen flex-col"
      }
    >
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Back to dashboard"
          onClick={() => router.refresh()}
        >
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Input
          className="max-w-md border-transparent text-base font-semibold shadow-none focus-visible:border-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {saving
            ? "Saving..."
            : dirty
              ? "Unsaved changes"
              : lastSavedAt
                ? "Saved"
                : ""}
          <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSvg}>
            <Download className="mr-1 h-4 w-4" /> SVG
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPng}>
            <ImageIcon className="mr-1 h-4 w-4" /> PNG
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen((f) => !f)}
            aria-label="Toggle fullscreen"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div
        className={
          fullscreen
            ? "grid flex-1 overflow-hidden grid-cols-1"
            : "grid flex-1 overflow-hidden md:grid-cols-[1fr_1fr_280px]"
        }
      >
        {!fullscreen && (
          <div className="border-r">
            <CodeEditor value={code} onChange={setCode} />
          </div>
        )}
        <div className={fullscreen ? "h-full" : "h-full"}>
          <MermaidPreview
            ref={previewRef}
            code={debouncedCode}
            theme={theme}
            customStyles={customStyles}
          />
        </div>
        {!fullscreen && (
          <aside className="overflow-auto border-l p-4">
            <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
            <StylePanel
              theme={theme}
              customStyles={customStyles}
              onThemeChange={setTheme}
              onStylesChange={setCustomStyles}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "diagram";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
