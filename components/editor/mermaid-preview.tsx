"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { useTheme } from "next-themes";
import {
  Focus,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  ScanEye,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sanitizeCss } from "@/lib/sanitize-css";
import type { Annotation, CustomStyles } from "@/lib/validators";
import {
  AnnotationLayer,
  type ActiveTool,
} from "@/components/editor/annotation-layer";

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
  getSvg: () => SVGSVGElement | null;
  fitToView: () => void;
};

type Props = {
  code: string;
  theme: MermaidTheme;
  customStyles?: CustomStyles;
  customCss?: string;
  /** Auto-switch to "dark" theme when the app is in dark mode. */
  darkAware?: boolean;
  /** Hide the toolbar (used by embed/iframe mode). */
  minimal?: boolean;
  annotations?: Annotation[];
  onAnnotationsChange?: (next: Annotation[]) => void;
  annotationTool?: ActiveTool;
  onAnnotationToolChange?: (t: ActiveTool) => void;
};

export const MermaidPreview = React.forwardRef<MermaidPreviewHandle, Props>(
  function MermaidPreview(
    {
      code,
      theme,
      customStyles,
      customCss,
      darkAware = true,
      minimal = false,
      annotations = [],
      onAnnotationsChange,
      annotationTool = null,
      onAnnotationToolChange,
    },
    ref,
  ) {
    void onAnnotationToolChange;
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const stageRef = React.useRef<HTMLDivElement>(null);
    const transformRef = React.useRef<Transform>(IDENTITY);
    const [transform, setTransformState] = React.useState<Transform>(IDENTITY);
    const [error, setError] = React.useState<string | null>(null);
    const [hasContent, setHasContent] = React.useState(false);
    const [hoverFocus, setHoverFocus] = React.useState(true);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [svgSize, setSvgSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const { resolvedTheme } = useTheme();

    const effectiveTheme: MermaidTheme =
      darkAware && resolvedTheme === "dark" && theme === "default" ? "dark" : theme;

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

      setSvgSize({ w: svgW, h: svgH });
      setTransform({ x, y, scale });
    }, [setTransform]);

    React.useEffect(() => {
      fitToViewRef.current = fitToView;
    }, [fitToView]);

    // Render the diagram.
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
          theme: effectiveTheme,
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
            ADD_TAGS: ["foreignObject", "style"],
          });
          const svgEl = stageRef.current.querySelector("svg") as SVGSVGElement | null;
          if (svgEl) {
            svgEl.style.maxWidth = "none";
            svgEl.style.height = "auto";
            if (customStyles?.background) {
              svgEl.style.background = customStyles.background;
            }
            if (customCss) {
              const style = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "style",
              );
              style.textContent = sanitizeCss(customCss);
              svgEl.insertBefore(style, svgEl.firstChild);
            }
          }
          setHasContent(true);
          setError(null);
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
    }, [code, effectiveTheme, customStyles, customCss, fitToView]);

    // Re-fit on viewport resize when in identity transform.
    React.useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const observer = new ResizeObserver(() => {
        const t = transformRef.current;
        if (Math.abs(t.scale - 1) < 0.001 && t.x === 0 && t.y === 0) return;
        fitToView();
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }, [fitToView]);

    // Wheel + pinch zoom (trackpad pinch arrives as wheel + ctrlKey on Chrome/Edge/Safari).
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
        // Pinch (ctrlKey) gets a stronger response; pure wheel is gentler.
        const intensity = e.ctrlKey ? 0.01 : 0.0015;
        const factor = Math.exp(-e.deltaY * intensity);
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

    // Touch pinch — track two pointers.
    const pointersRef = React.useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = React.useRef<{
      dist: number;
      cx: number;
      cy: number;
      scale: number;
      tx: number;
      ty: number;
    } | null>(null);

    const dragRef = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // While an annotation tool is active, the AnnotationLayer captures
      // pointer events for drawing — don't pan the diagram underneath.
      if (annotationTool) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2) {
        const [a, b] = Array.from(pointersRef.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = viewportRef.current!.getBoundingClientRect();
        pinchRef.current = {
          dist,
          cx: (a.x + b.x) / 2 - rect.left,
          cy: (a.y + b.y) / 2 - rect.top,
          scale: transformRef.current.scale,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
        dragRef.current = null;
      } else if (pointersRef.current.size === 1) {
        const t = transformRef.current;
        dragRef.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = Array.from(pointersRef.current.values());
        const newDist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = newDist / pinchRef.current.dist;
        const baseScale = pinchRef.current.scale;
        const nextScale = clamp(baseScale * ratio, MIN_SCALE, MAX_SCALE);
        const k = nextScale / baseScale;
        setTransform({
          scale: nextScale,
          x: pinchRef.current.cx - (pinchRef.current.cx - pinchRef.current.tx) * k,
          y: pinchRef.current.cy - (pinchRef.current.cy - pinchRef.current.ty) * k,
        });
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      setTransform({
        ...transformRef.current,
        x: drag.tx + (e.clientX - drag.x),
        y: drag.ty + (e.clientY - drag.y),
      });
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (pointersRef.current.size === 0) dragRef.current = null;
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

    // Keyboard shortcuts.
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
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
          // Only swallow inside the preview viewport — let Monaco's Find work elsewhere.
          if (viewportRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            setSearchOpen(true);
          }
        } else if (e.key === "Escape" && searchOpen) {
          setSearchOpen(false);
          setSearchQuery("");
        }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToView, searchOpen]);

    // Highlight matching nodes in the SVG when search query is present.
    React.useEffect(() => {
      const svg = stageRef.current?.querySelector("svg");
      if (!svg) return;
      const q = searchQuery.trim().toLowerCase();
      const nodes = svg.querySelectorAll(
        ".node, .actor, .classGroup, .entityBox, .cluster, .label",
      );
      nodes.forEach((n) => {
        const el = n as SVGGElement;
        if (!q) {
          el.classList.remove("mermaid-search-hit", "mermaid-search-miss");
          return;
        }
        const text = (el.textContent ?? "").toLowerCase();
        if (text.includes(q)) {
          el.classList.add("mermaid-search-hit");
          el.classList.remove("mermaid-search-miss");
        } else {
          el.classList.add("mermaid-search-miss");
          el.classList.remove("mermaid-search-hit");
        }
      });
      return () => {
        nodes.forEach((n) =>
          (n as SVGGElement).classList.remove("mermaid-search-hit", "mermaid-search-miss"),
        );
      };
    }, [searchQuery, code]);

    // Mini-map: visible only when zoomed in significantly.
    const showMiniMap =
      !minimal && hasContent && transform.scale > 1.2 && svgSize.w > 0 && svgSize.h > 0;

    return (
      <div className="relative flex h-full flex-col">
        {error && (
          <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-medium">Syntax error</div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs opacity-80">{error}</pre>
          </div>
        )}

        {searchOpen && !minimal && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-md backdrop-blur">
            <SearchIcon className="ml-2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Highlight nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div
          ref={viewportRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className="mermaid-preview relative flex-1 select-none overflow-hidden outline-none"
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

          {onAnnotationsChange && (
            <AnnotationLayer
              annotations={annotations}
              transform={transform}
              viewportSize={{
                w: viewportRef.current?.clientWidth ?? 0,
                h: viewportRef.current?.clientHeight ?? 0,
              }}
              tool={annotationTool}
              onChange={onAnnotationsChange}
              readOnly={minimal}
            />
          )}
          {minimal && annotations.length > 0 && (
            <AnnotationLayer
              annotations={annotations}
              transform={transform}
              viewportSize={{
                w: viewportRef.current?.clientWidth ?? 0,
                h: viewportRef.current?.clientHeight ?? 0,
              }}
              tool={null}
              onChange={() => {
                /* no-op in read-only embed */
              }}
              readOnly
            />
          )}
        </div>

        {showMiniMap && (
          <MiniMap
            svgSize={svgSize}
            transform={transform}
            viewport={viewportRef.current}
            stage={stageRef.current}
            onJump={(x, y) => setTransform({ ...transform, x, y })}
          />
        )}

        {!minimal && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-md backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8"
              onClick={() => setSearchOpen((v) => !v)}
              disabled={!hasContent}
              aria-label="Search nodes"
              title="Search nodes (Ctrl/Cmd+F)"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
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
        )}
      </div>
    );
  },
);

function MiniMap({
  svgSize,
  transform,
  viewport,
  stage,
  onJump,
}: {
  svgSize: { w: number; h: number };
  transform: Transform;
  viewport: HTMLDivElement | null;
  stage: HTMLDivElement | null;
  onJump: (x: number, y: number) => void;
}) {
  if (!viewport || !stage) return null;

  const MAP_W = 180;
  const MAP_H = Math.max(60, Math.round((svgSize.h / svgSize.w) * MAP_W));
  const ratio = MAP_W / svgSize.w;

  // The viewport rectangle inside the mini-map (in mini-map pixels).
  // The stage is offset by `transform.{x,y}` in viewport pixels and scaled by transform.scale.
  // So a point (px, py) in stage coords appears at (transform.x + px*scale, transform.y + py*scale).
  // The visible rectangle in stage coords is therefore:
  //   stageX0 = -transform.x / scale, stageY0 = -transform.y / scale
  //   stageX1 = stageX0 + viewportW / scale, stageY1 = stageY0 + viewportH / scale
  const stageX0 = -transform.x / transform.scale;
  const stageY0 = -transform.y / transform.scale;
  const visibleW = viewport.clientWidth / transform.scale;
  const visibleH = viewport.clientHeight / transform.scale;

  const rectX = clamp(stageX0 * ratio, 0, MAP_W);
  const rectY = clamp(stageY0 * ratio, 0, MAP_H);
  const rectW = clamp(visibleW * ratio, 8, MAP_W - rectX);
  const rectH = clamp(visibleH * ratio, 8, MAP_H - rectY);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!viewport) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Center the viewport on the clicked point.
    const stageX = mx / ratio;
    const stageY = my / ratio;
    const newTx = viewport.clientWidth / 2 - stageX * transform.scale;
    const newTy = viewport.clientHeight / 2 - stageY * transform.scale;
    onJump(newTx, newTy);
  }

  return (
    <div
      onClick={onClick}
      className="pointer-events-auto absolute right-3 top-3 cursor-crosshair overflow-hidden rounded-md border bg-card/90 shadow-md backdrop-blur"
      style={{ width: MAP_W, height: MAP_H }}
      title="Mini-map (click to jump)"
    >
      <div
        className="absolute border-2 border-primary bg-primary/10"
        style={{ left: rectX, top: rectY, width: rectW, height: rectH }}
      />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function exportSvg(svg: SVGSVGElement | null): string | null {
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}
