"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { Focus, Maximize, Minus, Plus, RotateCcw, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomStyles } from "@/lib/validators";

type MermaidTheme = "default" | "dark" | "forest" | "neutral" | "base";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidPromise;
}

let renderCounter = 0;

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

type Transform = { x: number; y: number; scale: number };

const IDENTITY: Transform = { x: 0, y: 0, scale: 1 };

export type MermaidPreviewHandle = {
  /** Returns the rendered SVG element, or null. */
  getSvg: () => SVGSVGElement | null;
  /** Programmatically fit the diagram to the viewport. */
  fitToView: () => void;
};

export const MermaidPreview = React.forwardRef<
  MermaidPreviewHandle,
  {
    code: string;
    theme: MermaidTheme;
    customStyles?: CustomStyles;
  }
>(function MermaidPreview({ code, theme, customStyles }, ref) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const transformRef = React.useRef<Transform>(IDENTITY);
  const [transform, setTransformState] = React.useState<Transform>(IDENTITY);
  const [error, setError] = React.useState<string | null>(null);
  const [hasContent, setHasContent] = React.useState(false);
  const [hoverFocus, setHoverFocus] = React.useState(true);

  const fitToViewRef = React.useRef<() => void>(() => {});

  React.useImperativeHandle(
    ref,
    () => ({
      getSvg: () =>
        (stageRef.current?.querySelector("svg") as SVGSVGElement | null) ?? null,
      fitToView: () => fitToViewRef.current(),
    }),
    [],
  );

  const setTransform = React.useCallback((t: Transform) => {
    transformRef.current = t;
    setTransformState(t);
  }, []);

  const fitToView = React.useCallback(() => {
    const viewport = viewportRef.current;
    const svg = stageRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!viewport || !svg) return;

    // Use the SVG's natural box (not the rendered one) so the fit math is
    // independent of the previous transform.
    const vb = svg.viewBox.baseVal;
    const svgW =
      vb && vb.width
        ? vb.width
        : svg.getBBox().width || svg.getBoundingClientRect().width;
    const svgH =
      vb && vb.height
        ? vb.height
        : svg.getBBox().height || svg.getBoundingClientRect().height;

    if (!svgW || !svgH) return;

    const padding = 32;
    const vpW = viewport.clientWidth - padding * 2;
    const vpH = viewport.clientHeight - padding * 2;
    const scale = Math.min(vpW / svgW, vpH / svgH, 1);

    const scaledW = svgW * scale;
    const scaledH = svgH * scale;
    const x = (viewport.clientWidth - scaledW) / 2;
    const y = (viewport.clientHeight - scaledH) / 2;

    setTransform({ x, y, scale });
  }, [setTransform]);

  React.useEffect(() => {
    fitToViewRef.current = fitToView;
  }, [fitToView]);

  // Render the diagram whenever code/theme/styles change.
  React.useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = await loadMermaid();

      const themeVariables: Record<string, string> = {};
      if (customStyles?.primaryColor) themeVariables.primaryColor = customStyles.primaryColor;
      if (customStyles?.background) themeVariables.background = customStyles.background;
      if (customStyles?.fontColor) themeVariables.textColor = customStyles.fontColor;
      if (customStyles?.fontFamily) themeVariables.fontFamily = customStyles.fontFamily;

      mermaid.initialize({
        startOnLoad: false,
        theme,
        securityLevel: "strict",
        flowchart: { useMaxWidth: false, htmlLabels: true },
        themeVariables: Object.keys(themeVariables).length ? themeVariables : undefined,
      });

      if (!code.trim()) {
        if (!cancelled && stageRef.current) {
          stageRef.current.innerHTML = "";
          setHasContent(false);
          setError(null);
        }
        return;
      }

      try {
        await mermaid.parse(code);
        const id = `mermaid-svg-${++renderCounter}`;
        const { svg } = await mermaid.render(id, code);
        if (cancelled || !stageRef.current) return;
        stageRef.current.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ["foreignObject"],
        });
        const svgEl = stageRef.current.querySelector("svg") as SVGSVGElement | null;
        if (svgEl) {
          // Mermaid sometimes sets max-width/height that breaks zoom math.
          svgEl.style.maxWidth = "none";
          svgEl.style.height = "auto";
          if (customStyles?.background) {
            svgEl.style.background = customStyles.background;
          }
        }
        setHasContent(true);
        setError(null);
        // Defer fit-to-view to next paint so layout is settled.
        requestAnimationFrame(() => {
          if (!cancelled) fitToView();
        });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to render diagram";
        setError(msg);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, theme, customStyles, fitToView]);

  // Re-fit when the viewport itself resizes.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      // Only auto-fit if the user hasn't manually transformed.
      // Heuristic: identity-ish transform → re-fit; otherwise leave alone.
      const t = transformRef.current;
      if (Math.abs(t.scale - 1) < 0.001 && t.x === 0 && t.y === 0) return;
      fitToView();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitToView]);

  // Wheel zoom — pinned to cursor position.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(e: WheelEvent) {
      if (!viewport) return;
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const t = transformRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = nextScale / t.scale;
      setTransform({
        scale: nextScale,
        x: cx - (cx - t.x) * k,
        y: cy - (cy - t.y) * k,
      });
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [setTransform]);

  // Drag to pan.
  const dragRef = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Allow link/text selection clicks to pass through normally on right-click.
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const t = transformRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform({
      ...transformRef.current,
      x: drag.tx + (e.clientX - drag.x),
      y: drag.ty + (e.clientY - drag.y),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const cx = viewport.clientWidth / 2;
    const cy = viewport.clientHeight / 2;
    const t = transformRef.current;
    const nextScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
    const k = nextScale / t.scale;
    setTransform({
      scale: nextScale,
      x: cx - (cx - t.x) * k,
      y: cy - (cy - t.y) * k,
    });
  }

  // Keyboard shortcuts: + / - / 0
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(1.2);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / 1.2);
      } else if (e.key === "0") {
        e.preventDefault();
        fitToView();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToView]);

  return (
    <div className="relative flex h-full flex-col">
      {error && (
        <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="font-medium">Syntax error</div>
          <pre className="mt-1 whitespace-pre-wrap break-words text-xs opacity-80">{error}</pre>
        </div>
      )}

      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className="mermaid-preview relative flex-1 select-none overflow-hidden"
        style={{
          background: customStyles?.background,
          cursor: dragRef.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <div
          ref={stageRef}
          data-hover-focus={hoverFocus ? "on" : "off"}
          className="mermaid-stage absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-md backdrop-blur">
        <Button
          variant={hoverFocus ? "secondary" : "ghost"}
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => setHoverFocus((v) => !v)}
          disabled={!hasContent}
          aria-pressed={hoverFocus}
          aria-label={hoverFocus ? "Disable hover focus" : "Enable hover focus"}
          title={
            hoverFocus
              ? "Hover focus: ON — click to unlock (show all)"
              : "Hover focus: OFF — click to lock (dim others)"
          }
        >
          {hoverFocus ? <ScanEye className="h-4 w-4" /> : <Focus className="h-4 w-4" />}
        </Button>
        <span className="pointer-events-none mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => zoomBy(1 / 1.2)}
          disabled={!hasContent}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="pointer-events-auto min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(transform.scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => zoomBy(1.2)}
          disabled={!hasContent}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={fitToView}
          disabled={!hasContent}
          aria-label="Fit to view"
          title="Fit to view (0)"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => setTransform(IDENTITY)}
          disabled={!hasContent}
          aria-label="Reset"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function exportSvg(svg: SVGSVGElement | null): string | null {
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}
