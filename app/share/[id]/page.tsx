import type { Metadata } from "next";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { MermaidPreview } from "@/components/editor/mermaid-preview";
import type { Annotation } from "@/lib/validators";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Code2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  if (!mongoose.Types.ObjectId.isValid(params.id)) return { title: "Mermaid Studio" };
  await connectDB();
  const doc = await Diagram.findOne({ _id: params.id, isPublic: true })
    .select("title")
    .lean();
  return {
    title: doc ? `${doc.title} — Mermaid Studio` : "Mermaid Studio",
    description: doc ? `Public Mermaid diagram: ${doc.title}` : undefined,
  };
}

function stripNulls<T extends Record<string, unknown>>(obj: T): {
  [K in keyof T]?: NonNullable<T[K]>;
} {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as { [K in keyof T]?: NonNullable<T[K]> };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { embed?: string };
}) {
  if (!mongoose.Types.ObjectId.isValid(params.id)) notFound();

  await connectDB();
  const doc = await Diagram.findOne({ _id: params.id, isPublic: true }).lean();
  if (!doc) notFound();

  const embed = searchParams.embed === "1";
  const data = {
    code: doc.code ?? "",
    theme: (doc.theme ?? "default") as "default" | "dark" | "forest" | "neutral" | "base",
    customStyles: stripNulls(doc.customStyles ?? {}),
    customCss: doc.customCss ?? "",
    annotations: (doc.annotations ?? []) as Annotation[],
    title: doc.title,
  };

  if (embed) {
    return (
      <main className="h-screen w-screen bg-background">
        <MermaidPreview
          code={data.code}
          theme={data.theme}
          customStyles={data.customStyles}
          customCss={data.customCss}
          annotations={data.annotations}
          minimal
        />
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded bg-primary" />
          <span className="text-sm font-semibold">{data.title}</span>
          <span className="text-xs text-muted-foreground">— shared diagram</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <Code2 className="mr-1 h-4 w-4" /> Open editor
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1">
        <MermaidPreview
          code={data.code}
          theme={data.theme}
          customStyles={data.customStyles}
          customCss={data.customCss}
          annotations={data.annotations}
          minimal
        />
      </div>
    </div>
  );
}
