"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ANNOTATION_COLORS } from "@/lib/annotation-colors";
import type { Annotation, AnnotationColor, AnnotationType } from "@/lib/validators";

type Transform = { x: number; y: number; scale: number };

export type ActiveTool = {
  type: AnnotationType;
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
    draftRef.current = { start: p, end: p };
    setDraft({ start: p, end: p });
  }

  function onLayerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draftRef.current) return;
    const p = toStage(e.clientX, e.clientY);
    draftRef.current = { ...draftRef.current, end: p };
    setDraft({ ...draftRef.current });
  }

  function onLayerPointerUp() {
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
        cursor: tool ? "crosshair" : "default",
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
            return (
              <g key={a.id}>
                <line
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  stroke={c.stroke}
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

        {/* Draft preview while drawing. */}
        {draft && tool && (
          <DraftShape draft={draft} tool={tool} transform={transform} />
        )}
      </svg>

      {/* HTML annotations: notes, highlights, pins. */}
      {annotations.map((a) => {
        if (a.type === "arrow") return null;
        const x = a.x * transform.scale + transform.x;
        const y = a.y * transform.scale + transform.y;
        const c = ANNOTATION_COLORS[a.color];
        const isSelected = selectedId === a.id;

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

function makeId() {
  // Cheap UUID-like — only needs to be locally unique inside a diagram.
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}
