"use client";

import * as React from "react";
import { Check, Copy, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { copyText } from "@/lib/clipboard";

export function ShareDialog({
  open,
  onOpenChange,
  diagramId,
  isPublic,
  onChangePublic,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  diagramId: string;
  isPublic: boolean;
  onChangePublic: (next: boolean) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<"link" | "embed" | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/share/${diagramId}`;
  const embedSnippet = `<iframe src="${shareUrl}?embed=1" width="100%" height="500" frameborder="0" loading="lazy"></iframe>`;

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/diagrams/${diagramId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not update sharing" });
      return;
    }
    onChangePublic(!isPublic);
    toast({ title: !isPublic ? "Diagram is now public" : "Diagram is now private" });
  }

  async function copy(value: string, kind: "link" | "embed") {
    const ok = await copyText(value);
    if (!ok) {
      toast({ variant: "destructive", title: "Copy failed" });
      return;
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share diagram</DialogTitle>
          <DialogDescription>
            Public diagrams can be viewed by anyone with the link — no sign-in required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            {isPublic ? (
              <Globe className="h-4 w-4 text-primary" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">
                {isPublic ? "Public" : "Private"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isPublic ? "Anyone with the link can view" : "Only you can view"}
              </div>
            </div>
          </div>
          <Button onClick={toggle} disabled={busy} variant={isPublic ? "outline" : "default"}>
            {isPublic ? "Make private" : "Make public"}
          </Button>
        </div>

        {isPublic && (
          <>
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={() => copy(shareUrl, "link")}>
                  {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Embed snippet</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={embedSnippet}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" onClick={() => copy(embedSnippet, "embed")}>
                  {copied === "embed" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this iframe in any HTML page to embed the live diagram.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
