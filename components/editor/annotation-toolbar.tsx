"use client";

import * as React from "react";
import { ArrowRight, Highlighter, MapPin, MousePointer2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANNOTATION_COLORS, COLOR_KEYS } from "@/lib/annotation-colors";
import type { AnnotationColor, AnnotationType } from "@/lib/validators";
import { cn } from "@/lib/utils";

type ActiveTool = { type: AnnotationType; color: AnnotationColor } | null;

const TOOLS: {
  type: AnnotationType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  hint: string;
}[] = [
  { type: "note", label: "Note", Icon: StickyNote, hint: "Click to drop a note" },
  {
    type: "highlight",
    label: "Highlight",
    Icon: Highlighter,
    hint: "Drag to draw a highlight box",
  },
  { type: "arrow", label: "Arrow", Icon: ArrowRight, hint: "Drag to draw an arrow" },
  { type: "pin", label: "Pin", Icon: MapPin, hint: "Click to drop a pin" },
];

export function AnnotationToolbar({
  tool,
  onToolChange,
  count,
  onClear,
}: {
  tool: ActiveTool;
  onToolChange: (t: ActiveTool) => void;
  count: number;
  onClear: () => void;
}) {
  const [color, setColor] = React.useState<AnnotationColor>(tool?.color ?? "yellow");

  function pick(t: AnnotationType) {
    if (tool?.type === t) {
      onToolChange(null);
      return;
    }
    onToolChange({ type: t, color });
  }

  function pickColor(c: AnnotationColor) {
    setColor(c);
    if (tool) onToolChange({ ...tool, color: c });
  }

  return (
    <div className="pointer-events-auto absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-md border bg-card/95 p-1 shadow-md backdrop-blur">
      <Button
        variant={tool === null ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => onToolChange(null)}
        title="Select / pan"
      >
        <MousePointer2 className="h-4 w-4" />
      </Button>
      <span className="my-0.5 h-px w-6 bg-border" />
      {TOOLS.map(({ type, Icon, label, hint }) => (
        <Button
          key={type}
          variant={tool?.type === type ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => pick(type)}
          title={`${label} — ${hint}`}
          aria-pressed={tool?.type === type}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}

      <span className="my-0.5 h-px w-6 bg-border" />

      {COLOR_KEYS.map((key) => {
        const c = ANNOTATION_COLORS[key];
        const active = (tool?.color ?? color) === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => pickColor(key)}
            aria-label={`${key} color`}
            title={key}
            className={cn(
              "h-5 w-5 rounded-full border transition-transform",
              active && "scale-110 ring-2 ring-offset-2 ring-offset-card",
            )}
            style={{
              background: c.fill,
              borderColor: c.border,
              boxShadow: active ? `0 0 0 1px ${c.border}` : undefined,
            }}
          />
        );
      })}

      {count > 0 && (
        <>
          <span className="my-0.5 h-px w-6 bg-border" />
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-destructive"
            title="Remove all annotations"
          >
            Clear
          </button>
          <span className="text-[10px] text-muted-foreground">{count}</span>
        </>
      )}
    </div>
  );
}
