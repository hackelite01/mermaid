"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "S"], label: "Save now" },
  { keys: ["Ctrl", "F"], label: "Search nodes (when preview is focused)" },
  { keys: ["+"], label: "Zoom in" },
  { keys: ["−"], label: "Zoom out" },
  { keys: ["0"], label: "Fit to view" },
  { keys: ["?"], label: "Show this cheatsheet" },
  { keys: ["Esc"], label: "Close dialog / search" },
];

export function KeyboardHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            On macOS, use ⌘ instead of Ctrl.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border bg-muted px-2 py-0.5 font-mono text-xs shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
          Pinch to zoom on a trackpad or touchscreen. Click-and-drag inside the
          preview to pan. Click the mini-map (top right when zoomed) to jump.
        </div>
      </DialogContent>
    </Dialog>
  );
}
