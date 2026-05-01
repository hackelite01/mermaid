"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Clock, FileCode, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { readRecent, type RecentDiagram } from "@/lib/recent";

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const [recent, setRecent] = React.useState<RecentDiagram[]>([]);

  React.useEffect(() => {
    const update = () => setRecent(readRecent());
    update();
    window.addEventListener("mermaid-recent-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("mermaid-recent-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold">
        <span className="inline-block h-6 w-6 rounded bg-primary" />
        Mermaid Studio
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        {recent.length > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Recent
            </div>
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/editor/${r.id}`}
                className="flex items-center gap-2 truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                title={r.title}
              >
                <FileCode className="h-4 w-4 shrink-0" />
                <span className="truncate">{r.title}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 truncate px-2 text-xs text-muted-foreground" title={userEmail ?? ""}>
          {userEmail}
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
