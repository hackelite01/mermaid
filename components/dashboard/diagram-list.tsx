"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Search, Trash2, Pencil, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatRelative } from "@/lib/utils";

type DiagramSummary = {
  id: string;
  title: string;
  theme: string;
  updatedAt: string;
};

export function DiagramList() {
  const router = useRouter();
  const { toast } = useToast();
  const [diagrams, setDiagrams] = React.useState<DiagramSummary[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<DiagramSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DiagramSummary | null>(null);

  const load = React.useCallback(async (q: string) => {
    const url = q ? `/api/diagrams?q=${encodeURIComponent(q)}` : "/api/diagrams";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setDiagrams([]);
      return;
    }
    const data = (await res.json()) as { diagrams: DiagramSummary[] };
    setDiagrams(data.diagrams);
  }, []);

  React.useEffect(() => {
    const id = setTimeout(() => load(query), 200);
    return () => clearTimeout(id);
  }, [query, load]);

  async function createDiagram() {
    setCreating(true);
    const res = await fetch("/api/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Untitled diagram",
        code: "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[OK]\n  B -->|No| D[Stop]",
        theme: "default",
      }),
    });
    setCreating(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not create diagram" });
      return;
    }
    const data = (await res.json()) as { id: string };
    router.push(`/editor/${data.id}`);
  }

  async function rename(id: string, title: string) {
    const res = await fetch(`/api/diagrams/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Rename failed" });
      return;
    }
    toast({ title: "Renamed" });
    setRenameTarget(null);
    load(query);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/diagrams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Delete failed" });
      return;
    }
    toast({ title: "Diagram deleted" });
    setDeleteTarget(null);
    load(query);
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your diagrams</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and manage all your Mermaid diagrams.
          </p>
        </div>
        <Button onClick={createDiagram} disabled={creating}>
          <Plus className="mr-1 h-4 w-4" />
          {creating ? "Creating..." : "New diagram"}
        </Button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {diagrams === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : diagrams.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <FileCode className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No diagrams yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first diagram to get started.
          </p>
          <Button onClick={createDiagram} disabled={creating}>
            <Plus className="mr-1 h-4 w-4" /> New diagram
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {diagrams.map((d) => (
            <Card key={d.id} className="group relative p-5 transition-shadow hover:shadow-md">
              <Link href={`/editor/${d.id}`} className="block">
                <h3 className="truncate font-semibold">{d.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.theme} · {formatRelative(d.updatedAt)}
                </p>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenameTarget(d)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteTarget(d)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename diagram</DialogTitle>
          </DialogHeader>
          {renameTarget && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
                if (title) rename(renameTarget.id, title);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={renameTarget.title} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete diagram?</DialogTitle>
            <DialogDescription>
              This permanently deletes &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && remove(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
