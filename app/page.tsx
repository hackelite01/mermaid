import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, Code2, Palette, Zap } from "lucide-react";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

      <header className="relative z-10 flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="inline-block h-6 w-6 rounded bg-primary" />
          Mermaid Studio
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          Diagrams that write themselves.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A modern Mermaid editor with live preview, syntax validation, theming,
          and cloud-saved diagrams. Built for engineers who think in code.
        </p>
        <div className="mt-10 flex gap-3">
          <Button size="lg" asChild>
            <Link href="/auth/signup">
              Start creating <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full gap-6 md:grid-cols-3">
          {[
            {
              icon: Code2,
              title: "Monaco editor",
              body: "Full VS Code experience with syntax highlighting and keybindings.",
            },
            {
              icon: Zap,
              title: "Real-time preview",
              body: "Debounced rendering for instant feedback as you type.",
            },
            {
              icon: Palette,
              title: "Custom theming",
              body: "Pick built-in themes or fine-tune colors per diagram.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border bg-card p-6 text-left">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
