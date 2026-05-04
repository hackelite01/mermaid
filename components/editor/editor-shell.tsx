"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  History,
  Image as ImageIcon,
  Keyboard,
  Maximize2,
  Minimize2,
  Save,
  Share2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { CodeEditor } from "@/components/editor/monaco-editor";
import {
  MermaidPreview,
  exportSvg,
  type MermaidPreviewHandle,
} from "@/components/editor/mermaid-preview";
import { StylePanel } from "@/components/editor/style-panel";
import { TemplatesMenu } from "@/components/editor/templates-menu";
import { ShareDialog } from "@/components/editor/share-dialog";
import { VersionHistory } from "@/components/editor/version-history";
import { KeyboardHelp } from "@/components/editor/keyboard-help";
import { AnnotationToolbar } from "@/components/editor/annotation-toolbar";
import type { ActiveTool } from "@/components/editor/annotation-layer";
import { useDiagramStore, type MermaidTheme } from "@/store/diagram-store";
import type { Annotation, CustomStyles } from "@/lib/validators";
import { debounce } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { formatMermaid } from "@/lib/format-mermaid";
import { recordRecent } from "@/lib/recent";

export type DiagramApiPayload = {
  id: string;
  title: string;
  code: string;
  theme: MermaidTheme;
  customStyles: CustomStyles;
  customCss: string;
  tags: string[];
  annotations: Annotation[];
  isPublic: boolean;
};

export function EditorShell({ initial }: { initial: DiagramApiPayload }) {
  const router = useRouter();
  const { toast } = useToast();
  const previewRef = React.useRef<MermaidPreviewHandle>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [debouncedCode, setDebouncedCode] = React.useState(initial.code);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [copyState, setCopyState] = React.useState<string | null>(null);
  const [annotationTool, setAnnotationTool] = React.useState<ActiveTool>(null);

  const {
    id,
    title,
    code,
    theme,
    customStyles,
    customCss,
    tags,
    annotations,
    isPublic,
    dirty,
    saving,
    lastSavedAt,
    hydrate,
    setTitle,
    setCode,
    setTheme,
    setCustomStyles,
    setCustomCss,
    setTags,
    setAnnotations,
    setIsPublic,
    setSaving,
    markSaved,
  } = useDiagramStore();

  React.useEffect(() => {
    hydrate(initial);
    recordRecent(initial.id, initial.title);
  }, [initial, hydrate]);

  React.useEffect(() => {
    if (id && title) recordRecent(id, title);
  }, [id, title]);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => previewRef.current?.fitToView());
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);

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
        body: JSON.stringify({
          title,
          code,
          theme,
          customStyles,
          customCss,
          tags,
          annotations,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ variant: "destructive", title: "Save failed", description: data.error });
        setSaving(false);
        return;
      }
      markSaved();
    } catch {
      setSaving(false);
      toast({ variant: "destructive", title: "Save failed" });
    }
  }, [
    id,
    title,
    code,
    theme,
    customStyles,
    customCss,
    tags,
    annotations,
    setSaving,
    markSaved,
    toast,
  ]);

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
  }, [dirty, title, code, theme, customStyles, customCss, tags, annotations]);

  // Global keyboard: Ctrl/Cmd+S, ?, Shift+Alt+F.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inField = target && /input|textarea/i.test(target.tagName);

      if (isMod && e.key === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "?" && !inField) {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.shiftKey && e.altKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        const formatted = formatMermaid(code);
        if (formatted !== code) {
          setCode(formatted);
          toast({ title: "Code formatted" });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, code, setCode, toast]);

  function applyTemplate(snippet: string) {
    if (
      code.trim() &&
      !window.confirm("Replace current diagram with this template?")
    ) {
      return;
    }
    setCode(snippet);
  }

  function format() {
    const next = formatMermaid(code);
    if (next === code) {
      toast({ title: "Already formatted" });
    } else {
      setCode(next);
      toast({ title: "Code formatted" });
    }
  }

  function downloadSvg() {
    const svg = exportSvg(previewRef.current?.getSvg() ?? null);
    if (!svg) return toast({ variant: "destructive", title: "Nothing to export" });
    triggerDownload(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${safeFilename(title)}.svg`,
    );
  }

  async function copySvg() {
    const svg = exportSvg(previewRef.current?.getSvg() ?? null);
    if (!svg) return toast({ variant: "destructive", title: "Nothing to copy" });
    const ok = await copyText(svg);
    flashCopy(ok ? "svg" : null);
    toast({ title: ok ? "SVG copied" : "Copy failed", variant: ok ? "default" : "destructive" });
  }

  async function copyMarkdown() {
    if (!code.trim()) return toast({ variant: "destructive", title: "Nothing to copy" });
    const md = "```mermaid\n" + code.replace(/```/g, "\\`\\`\\`") + "\n```\n";
    const ok = await copyText(md);
    flashCopy(ok ? "md" : null);
    toast({
      title: ok ? "Markdown copied" : "Copy failed",
      variant: ok ? "default" : "destructive",
    });
  }

  function flashCopy(kind: string | null) {
    setCopyState(kind);
    if (kind) setTimeout(() => setCopyState(null), 1500);
  }

  async function downloadPng() {
    const svgEl = previewRef.current?.getSvg();
    if (!svgEl) return toast({ variant: "destructive", title: "Nothing to export" });
    try {
      const blob = await renderSvgToPng(svgEl);
      triggerDownload(blob, `${safeFilename(title)}.png`);
    } catch {
      toast({ variant: "destructive", title: "PNG export failed" });
    }
  }

  async function copyPng() {
    const svgEl = previewRef.current?.getSvg();
    if (!svgEl) return toast({ variant: "destructive", title: "Nothing to copy" });
    try {
      const blob = await renderSvgToPng(svgEl);
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      flashCopy("png");
      toast({ title: "PNG copied" });
    } catch {
      toast({ variant: "destructive", title: "Copy failed" });
    }
  }

  const Status = saving
    ? "Saving..."
    : dirty
      ? "Unsaved changes"
      : lastSavedAt
        ? "Saved"
        : "";

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex h-screen flex-col"
      }
    >
      <header className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Input
          className="w-56 border-transparent text-base font-semibold shadow-none focus-visible:border-input md:w-72"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <TemplatesMenu onPick={applyTemplate} />
        <Button variant="outline" size="sm" onClick={format} title="Format (Shift+Alt+F)">
          <Wand2 className="mr-1 h-4 w-4" /> Format
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden md:inline">{Status}</span>

          <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={downloadSvg}>
                <Download className="mr-2 h-4 w-4" /> Download SVG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={downloadPng}>
                <ImageIcon className="mr-2 h-4 w-4" /> Download PNG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={copySvg}>
                {copyState === "svg" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}{" "}
                Copy SVG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyPng}>
                {copyState === "png" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}{" "}
                Copy PNG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyMarkdown}>
                {copyState === "md" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}{" "}
                Copy Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-1 h-4 w-4" /> Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionsOpen(true)}
            title="Version history"
          >
            <History className="mr-1 h-4 w-4" /> History
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
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
            ? "grid flex-1 grid-cols-1 overflow-hidden"
            : "grid flex-1 overflow-hidden md:grid-cols-[1fr_1fr_300px]"
        }
      >
        {!fullscreen && (
          <div className="border-r">
            <CodeEditor value={code} onChange={setCode} />
          </div>
        )}
        <div className="relative h-full">
          <MermaidPreview
            ref={previewRef}
            code={debouncedCode}
            theme={theme}
            customStyles={customStyles}
            customCss={customCss}
            annotations={annotations}
            onAnnotationsChange={setAnnotations}
            annotationTool={annotationTool}
          />
          {!fullscreen && (
            <AnnotationToolbar
              tool={annotationTool}
              onToolChange={setAnnotationTool}
              count={annotations.length}
              onClear={() => {
                if (annotations.length === 0) return;
                if (window.confirm(`Remove all ${annotations.length} annotations?`)) {
                  setAnnotations([]);
                  setAnnotationTool(null);
                }
              }}
            />
          )}
        </div>
        {!fullscreen && (
          <aside className="overflow-auto border-l p-4">
            <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
            <StylePanel
              theme={theme}
              customStyles={customStyles}
              customCss={customCss}
              tags={tags}
              onThemeChange={setTheme}
              onStylesChange={setCustomStyles}
              onCustomCssChange={setCustomCss}
              onTagsChange={setTags}
            />
          </aside>
        )}
      </div>

      {id && (
        <>
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            diagramId={id}
            isPublic={isPublic}
            onChangePublic={setIsPublic}
          />
          <VersionHistory
            open={versionsOpen}
            onOpenChange={setVersionsOpen}
            diagramId={id}
            currentCode={code}
            onRestore={(d) => {
              setTitle(d.title);
              setCode(d.code);
              setTheme(d.theme as MermaidTheme);
              setCustomStyles((d.customStyles as CustomStyles) ?? {});
              setCustomCss(d.customCss ?? "");
              setAnnotations([]);
              router.refresh();
            }}
          />
        </>
      )}

      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

async function renderSvgToPng(svgEl: SVGSVGElement): Promise<Blob> {
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
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("toBlob returned null"));
      else resolve(blob);
    }, "image/png");
  });
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
