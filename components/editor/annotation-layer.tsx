"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ANNOTATION_COLORS } from "@/lib/annotation-colors";
import type { Annotation, AnnotationColor, AnnotationType } from "@/lib/validators";

type Transform = { x: number; y: number; scale: number };

/**
 * Eraser is a transient mode that deletes annotations on contact — it is not
 * itself persisted as an annotation, so it lives alongside the real types here.
 */
export type ToolKind = AnnotationType | "eraser";
export type ActiveTool = {
  type: ToolKind;
  color: AnnotationColor;
} | null;

type Props = {
  annotations: Annotation[];
  transform: Transform;
  viewportSize: { w: number; h: number };
  /** Active drawing tool. When non-null, the layer captures pointer events. */
  tool: ActiveTool;
  /** Disable all interaction (used in embed/share view). */
  readOnly?: boolean;
  onChange: (next: Annotation[]) => void;
  /** Called once a new annotation has been committed so the toolbar can clear. */
  onCreated?: (a: Annotation) => void;
};

export function AnnotationLayer({
  annotations,
  transform,
  tool,
  readOnly,
  onChange,
  onCreated,
}: Props) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const draftRef = React.useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = React.useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  // Free-form pen draft — stage-coordinate points being captured live.
  const penPointsRef = React.useRef<[number, number][] | null>(null);
  const [penPoints, setPenPoints] = React.useState<[number, number][] | null>(null);
  // Eraser state — set of ids the user has dragged over since pointer-down.
  const eraseDragRef = React.useRef<Set<string> | null>(null);
  const [eraseMarked, setEraseMarked] = React.useState<Set<string>>(new Set());
  const dragRef = React.useRef<{
    id: string;
    pointerStart: { x: number; y: number };
    annStart: Annotation;
  } | null>(null);

  // Translate a viewport-pixel coord to stage coords (the coordinate system
  // annotations are stored in).
  const toStage = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - transform.x) / transform.scale,
        y: (clientY - rect.top - transform.y) / transform.scale,
      };
    },
    [transform],
  );

  // Keyboard: Delete removes selected.
  React.useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, annotations, onChange]);

  // ---- create flow (when tool is active) -----------------------------------
  function onLayerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (readOnly || !tool) return;
    if (e.target !== e.currentTarget) return; // ignore clicks on existing annotations
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toStage(e.clientX, e.clientY);

    if (tool.type === "eraser") {
      const set = new Set<string>();
      const hits = hitTest(p.x, p.y, annotations, transform.scale);
      hits.forEach((id) => set.add(id));
      eraseDragRef.current = set;
      setEraseMarked(new Set(set));
      return;
    }

    if (tool.type === "pen") {
      penPointsRef.current = [[p.x, p.y]];
      setPenPoints(penPointsRef.current);
      return;
    }

    draftRef.current = { start: p, end: p };
    setDraft({ start: p, end: p });
  }

  function onLayerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (eraseDragRef.current && tool?.type === "eraser") {
      const p = toStage(e.clientX, e.clientY);
      const hits = hitTest(p.x, p.y, annotations, transform.scale);
      let changed = false;
      for (const id of hits) {
        if (!eraseDragRef.current.has(id)) {
          eraseDragRef.current.add(id);
          changed = true;
        }
      }
      if (changed) setEraseMarked(new Set(eraseDragRef.current));
      return;
    }
    if (penPointsRef.current) {
      const p = toStage(e.clientX, e.clientY);
      const last = penPointsRef.current[penPointsRef.current.length - 1];
      // Throttle by min distance (in stage units) so the points list
      // doesn't explode on high-frequency moves.
      const minDist = 1.5 / transform.scale;
      if (Math.hypot(p.x - last[0], p.y - last[1]) >= minDist) {
        penPointsRef.current.push([p.x, p.y]);
        setPenPoints([...penPointsRef.current]);
      }
      return;
    }
    if (!draftRef.current) return;
    const p = toStage(e.clientX, e.clientY);
    draftRef.current = { ...draftRef.current, end: p };
    setDraft({ ...draftRef.current });
  }

  function onLayerPointerUp() {
    // Eraser commit.
    if (eraseDragRef.current) {
      const ids = eraseDragRef.current;
      eraseDragRef.current = null;
      setEraseMarked(new Set());
      if (ids.size > 0) {
        onChange(annotations.filter((a) => !ids.has(a.id)));
        if (selectedId && ids.has(selectedId)) setSelectedId(null);
      }
      return;
    }

    // Pen commit.
    if (penPointsRef.current) {
      const points = penPointsRef.current;
      penPointsRef.current = null;
      setPenPoints(null);
      if (!tool || points.length < 2) return; // throw away tap-without-drag
      const id = makeId();
      const ann: Annotation = {
        id,
        type: "pen",
        color: tool.color,
        x: points[0][0],
        y: points[0][1],
        points: points.slice(0, 2_000),
      };
      onChange([...annotations, ann]);
      onCreated?.(ann);
      setSelectedId(id);
      return;
    }

    if (!tool || !draftRef.current) return;
    const { start, end } = draftRef.current;
    draftRef.current = null;
    setDraft(null);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dragged = Math.hypot(dx, dy) > 4;

    const id = makeId();
    let ann: Annotation;
    switch (tool.type) {
      case "highlight":
        ann = {
          id,
          type: "highlight",
          color: tool.color,
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: dragged ? Math.abs(dx) : 120,
          h: dragged ? Math.abs(dy) : 60,
        };
        break;
      case "arrow":
        ann = {
          id,
          type: "arrow",
          color: tool.color,
          x: start.x,
          y: start.y,
          endX: dragged ? end.x : start.x + 80,
          endY: dragged ? end.y : start.y + 40,
        };
        break;
      case "note":
        ann = {
          id,
          type: "note",
          color: tool.color,
          x: start.x,
          y: start.y,
          w: 160,
          h: 80,
          text: "",
        };
        break;
      case "pin":
        ann = { id, type: "pin", color: tool.color, x: start.x, y: start.y };
        break;
      case "pen":
      case "eraser":
        // Handled above.
        return;
    }

    onChange([...annotations, ann]);
    onCreated?.(ann);
    setSelectedId(id);
    if (ann.type === "note") setEditingId(id);
  }

  // ---- move flow (when not in create mode, click an annotation) -----------
  function startMove(e: React.PointerEvent, ann: Annotation) {
    if (readOnly || tool) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedId(ann.id);
    dragRef.current = {
      id: ann.id,
      pointerStart: { x: e.clientX, y: e.clientY },
      annStart: { ...ann },
    };
  }

  function onMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.pointerStart.x) / transform.scale;
    const dy = (e.clientY - drag.pointerStart.y) / transform.scale;
    const next = annotations.map((a) => {
      if (a.id !== drag.id) return a;
      const moved: Annotation = {
        ...drag.annStart,
        x: drag.annStart.x + dx,
        y: drag.annStart.y + dy,
      };
      if (a.type === "arrow" && drag.annStart.endX != null && drag.annStart.endY != null) {
        moved.endX = drag.annStart.endX + dx;
        moved.endY = drag.annStart.endY + dy;
      }
      if (a.type === "pen" && drag.annStart.points) {
        moved.points = drag.annStart.points.map(([px, py]) => [
          px + dx,
          py + dy,
        ]) as [number, number][];
      }
      return moved;
    });
    onChange(next);
  }

  function onMoveEnd() {
    dragRef.current = null;
  }

  function remove(id: string) {
    onChange(annotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  function updateText(id: string, text: string) {
    onChange(annotations.map((a) => (a.id === id ? { ...a, text } : a)));
  }

  // Lines rendered in viewport coords (so their stroke width doesn't scale weirdly).
  const renderArrow = (a: Annotation) => {
    if (a.type !== "arrow" || a.endX == null || a.endY == null) return null;
    return {
      x1: a.x * transform.scale + transform.x,
      y1: a.y * transform.scale + transform.y,
      x2: a.endX * transform.scale + transform.x,
      y2: a.endY * transform.scale + transform.y,
    };
  };

  return (
    <div
      ref={layerRef}
      onPointerDown={onLayerPointerDown}
      onPointerMove={onLayerPointerMove}
      onPointerUp={onLayerPointerUp}
      onPointerCancel={onLayerPointerUp}
      onPointerLeave={(e) => {
        // Don't end an in-progress draft when hovering over a child annotation.
        if ((e.target as Element).contains(e.relatedTarget as Element)) return;
      }}
      className="pointer-events-auto absolute inset-0"
      style={{
        cursor: tool?.type === "eraser" ? "cell" : tool ? "crosshair" : "default",
        // When no tool is active, let pan events through to the viewport
        // unless they hit an annotation child.
        pointerEvents: tool || annotations.length ? "auto" : "none",
      }}
    >
      {/* Arrow / highlight overlay drawn in viewport pixels via SVG. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          {Object.entries(ANNOTATION_COLORS).map(([key, c]) => (
            <marker
              key={`arrow-${key}`}
              id={`ann-arrow-${key}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c.fill} />
            </marker>
          ))}
        </defs>

        {annotations
          .filter((a) => a.type === "arrow")
          .map((a) => {
            const r = renderArrow(a);
            if (!r) return null;
            const c = ANNOTATION_COLORS[a.color];
            const isSelected = selectedId === a.id;
            const marked = eraseMarked.has(a.id);
            return (
              <g key={a.id} opacity={marked ? 0.35 : 1}>
                <line
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  stroke={marked ? "#ef4444" : c.stroke}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeLinecap="round"
                  markerEnd={`url(#ann-arrow-${a.color})`}
                  style={{ pointerEvents: "stroke", cursor: "move" }}
                  className="pointer-events-auto"
                  onPointerDown={(e) => startMove(e as unknown as React.PointerEvent, a)}
                  onPointerMove={(e) => onMove(e as unknown as React.PointerEvent)}
                  onPointerUp={onMoveEnd}
                  onPointerCancel={onMoveEnd}
                />
              </g>
            );
          })}

        {annotations
          .filter((a) => a.type === "pen" && a.points && a.points.length >= 2)
          .map((a) => {
            const c = ANNOTATION_COLORS[a.color];
            const isSelected = selectedId === a.id;
            const marked = eraseMarked.has(a.id);
            const d = pointsToPath(a.points!, transform);
            return (
              <path
                key={a.id}
                d={d}
                fill="none"
                stroke={marked ? "#ef4444" : c.stroke}
                strokeWidth={isSelected ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={marked ? 0.35 : 1}
                style={{ pointerEvents: "stroke", cursor: "move" }}
                className="pointer-events-auto"
                onPointerDown={(e) =>
                  startMove(e as unknown as React.PointerEvent, a)
                }
                onPointerMove={(e) => onMove(e as unknown as React.PointerEvent)}
                onPointerUp={onMoveEnd}
                onPointerCancel={onMoveEnd}
              />
            );
          })}

        {/* Draft preview while drawing. */}
        {draft && tool && (
          <DraftShape draft={draft} tool={tool} transform={transform} />
        )}
        {penPoints && penPoints.length >= 2 && tool?.type === "pen" && (
          <path
            d={pointsToPath(penPoints, transform)}
            fill="none"
            stroke={ANNOTATION_COLORS[tool.color].stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0"
            opacity={0.85}
          />
        )}
      </svg>

      {/* HTML annotations: notes, highlights, pins. */}
      {annotations.map((a) => {
        if (a.type === "arrow" || a.type === "pen") return null;
        const x = a.x * transform.scale + transform.x;
        const y = a.y * transform.scale + transform.y;
        const c = ANNOTATION_COLORS[a.color];
        const isSelected = selectedId === a.id;
        const marked = eraseMarked.has(a.id);
        const markedStyle = marked
          ? { opacity: 0.35, outline: "2px dashed #ef4444", outlineOffset: 2 }
          : null;

        if (a.type === "pin") {
          const size = 14;
          return (
            <button
              type="button"
              key={a.id}
              onPointerDown={(e) => startMove(e, a)}
              onPointerMove={onMove}
              onPointerUp={onMoveEnd}
              onPointerCancel={onMoveEnd}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(a.id);
              }}
              title="Pin"
              className="absolute"
              style={{
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: "50%",
                background: c.fill,
                border: `2px solid ${c.border}`,
                boxShadow: isSelected ? `0 0 0 3px ${c.bg}` : "0 1px 3px rgba(0,0,0,0.25)",
                cursor: "move",
                ...markedStyle,
              }}
            />
          );
        }

        if (a.type === "highlight") {
          const w = (a.w ?? 120) * transform.scale;
          const h = (a.h ?? 60) * transform.scale;
          return (
            <div
              key={a.id}
              onPointerDown={(e) => startMove(e, a)}
              onPointerMove={onMove}
              onPointerUp={onMoveEnd}
              onPointerCancel={onMoveEnd}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(a.id);
              }}
              className="absolute"
              style={{
                left: x,
                top: y,
                width: w,
                height: h,
                background: c.bg,
                border: `${isSelected ? 2 : 1}px solid ${c.border}`,
                borderRadius: 4,
                cursor: "move",
                ...markedStyle,
              }}
            >
              {isSelected && !readOnly && (
                <DeleteHandle onClick={() => remove(a.id)} />
              )}
            </div>
          );
        }

        // note
        const w = (a.w ?? 160) * transform.scale;
        const h = (a.h ?? 80) * transform.scale;
        return (
          <div
            key={a.id}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
              startMove(e, a);
            }}
            onPointerMove={onMove}
            onPointerUp={onMoveEnd}
            onPointerCancel={onMoveEnd}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(a.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(a.id);
            }}
            className="absolute overflow-hidden rounded-sm shadow-md"
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              background: c.fill,
              border: `${isSelected ? 2 : 1}px solid ${c.border}`,
              cursor: editingId === a.id ? "text" : "move",
              ...markedStyle,
            }}
          >
            {editingId === a.id && !readOnly ? (
              <textarea
                autoFocus
                defaultValue={a.text ?? ""}
                onBlur={(e) => {
                  updateText(a.id, e.currentTarget.value);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingId(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="block h-full w-full resize-none bg-transparent p-1.5 text-xs outline-none"
                style={{ color: c.text, fontSize: Math.max(10, 12 * transform.scale) }}
              />
            ) : (
              <div
                className="h-full w-full whitespace-pre-wrap break-words p-1.5 text-xs"
                style={{ color: c.text, fontSize: Math.max(10, 12 * transform.scale) }}
              >
                {a.text || (
                  <span className="opacity-60">Double-click to edit</span>
                )}
              </div>
            )}
            {isSelected && editingId !== a.id && !readOnly && (
              <DeleteHandle onClick={() => remove(a.id)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DraftShape({
  draft,
  tool,
  transform,
}: {
  draft: { start: { x: number; y: number }; end: { x: number; y: number } };
  tool: NonNullable<ActiveTool>;
  transform: Transform;
}) {
  const sx = draft.start.x * transform.scale + transform.x;
  const sy = draft.start.y * transform.scale + transform.y;
  const ex = draft.end.x * transform.scale + transform.x;
  const ey = draft.end.y * transform.scale + transform.y;
  const c = ANNOTATION_COLORS[tool.color];

  if (tool.type === "arrow") {
    return (
      <line
        x1={sx}
        y1={sy}
        x2={ex}
        y2={ey}
        stroke={c.stroke}
        strokeWidth={2}
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
    );
  }
  if (tool.type === "highlight") {
    return (
      <rect
        x={Math.min(sx, ex)}
        y={Math.min(sy, ey)}
        width={Math.abs(ex - sx)}
        height={Math.abs(ey - sy)}
        fill={c.bg}
        stroke={c.border}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
    );
  }
  return null;
}

function DeleteHandle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-destructive"
      aria-label="Delete annotation"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/**
 * Object-eraser hit test. `sx,sy` is in stage coords; the hit threshold is
 * 8 viewport pixels regardless of zoom (so erasing feels the same when
 * zoomed in or out).
 */
function hitTest(
  sx: number,
  sy: number,
  annotations: Annotation[],
  scale: number,
): string[] {
  const radius = 8 / Math.max(scale, 0.1);
  const hits: string[] = [];
  for (const a of annotations) {
    if (a.type === "pin") {
      if (Math.hypot(sx - a.x, sy - a.y) <= radius + 6) hits.push(a.id);
      continue;
    }
    if (a.type === "note" || a.type === "highlight") {
      const w = a.w ?? 160;
      const h = a.h ?? 80;
      if (
        sx >= a.x - radius &&
        sx <= a.x + w + radius &&
        sy >= a.y - radius &&
        sy <= a.y + h + radius
      ) {
        hits.push(a.id);
      }
      continue;
    }
    if (a.type === "arrow" && a.endX != null && a.endY != null) {
      if (pointToSegment(sx, sy, a.x, a.y, a.endX, a.endY) <= radius)
        hits.push(a.id);
      continue;
    }
    if (a.type === "pen" && a.points && a.points.length >= 2) {
      const pts = a.points;
      for (let i = 1; i < pts.length; i++) {
        if (
          pointToSegment(sx, sy, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <=
          radius
        ) {
          hits.push(a.id);
          break;
        }
      }
    }
  }
  return hits;
}

function pointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointsToPath(points: [number, number][], transform: Transform): string {
  if (points.length === 0) return "";
  const [x0, y0] = points[0];
  let d = `M ${x0 * transform.scale + transform.x} ${y0 * transform.scale + transform.y}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i];
    d += ` L ${px * transform.scale + transform.x} ${py * transform.scale + transform.y}`;
  }
  return d;
}

function makeId() {
  // Cheap UUID-like — only needs to be locally unique inside a diagram.
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}
