"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatRelative } from "@/lib/utils";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);

type Version = {
  id: string;
  label: string | null;
  createdAt: string;
  code: string;
};

export function VersionHistory({
  open,
  onOpenChange,
  diagramId,
  currentCode,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  diagramId: string;
  currentCode: string;
  onRestore: (data: { title: string; code: string; theme: string; customStyles: unknown; customCss: string }) => void;
}) {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [versions, setVersions] = React.useState<Version[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const selected = versions?.find((v) => v.id === selectedId);

  React.useEffect(() => {
    if (!open) return;
    setVersions(null);
    setSelectedId(null);
    fetch(`/api/diagrams/${diagramId}/versions`)
      .then((r) => r.json())
      .then((data: { versions: Version[] }) => {
        setVersions(data.versions ?? []);
        if (data.versions?.[0]) setSelectedId(data.versions[0].id);
      })
      .catch(() => setVersions([]));
  }, [open, diagramId]);

  async function snapshot() {
    const res = await fetch(`/api/diagrams/${diagramId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Manual snapshot" }),
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Snapshot failed" });
      return;
    }
    toast({ title: "Snapshot saved" });
    const data = (await fetch(`/api/diagrams/${diagramId}/versions`).then((r) =>
      r.json(),
    )) as { versions: Version[] };
    setVersions(data.versions ?? []);
  }

  async function restore() {
    if (!selectedId) return;
    setRestoring(true);
    const res = await fetch(`/api/diagrams/${diagramId}/versions/${selectedId}`, {
      method: "POST",
    });
    setRestoring(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Restore failed" });
      return;
    }
    const data = await res.json();
    onRestore(data);
    onOpenChange(false);
    toast({ title: "Version restored" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Up to 50 most recent versions. Saving new code creates a snapshot of the
            previous state automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="space-y-1 overflow-auto" style={{ maxHeight: 460 }}>
            <Button
              variant="outline"
              size="sm"
              className="mb-2 w-full"
              onClick={snapshot}
            >
              <History className="mr-1 h-4 w-4" /> Snapshot now
            </Button>
            {versions === null ? (
              <>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </>
            ) : versions.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">No versions yet.</p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full rounded-md border p-2 text-left text-sm transition-colors ${
                    selectedId === v.id
                      ? "border-primary bg-accent"
                      : "border-transparent hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium">
                    {v.label ?? "Auto-saved"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(v.createdAt)}
                  </div>
                </button>
              ))
            )}
          </aside>

          <div className="overflow-hidden rounded-md border">
            {selected ? (
              <DiffEditor
                height="420px"
                original={selected.code}
                modified={currentCode}
                theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                }}
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                Select a version to compare with current.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={restore}
            disabled={!selected || restoring}
            variant="destructive"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Restore this version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
