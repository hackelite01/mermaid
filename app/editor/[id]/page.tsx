import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { EditorShell, type DiagramApiPayload } from "@/components/editor/editor-shell";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  if (!mongoose.Types.ObjectId.isValid(params.id)) notFound();

  await connectDB();
  const doc = await Diagram.findOne({
    _id: params.id,
    userId: session.user.id,
  }).lean();

  if (!doc) notFound();

  const initial: DiagramApiPayload = {
    id: doc._id.toString(),
    title: doc.title,
    code: doc.code ?? "",
    theme: (doc.theme ?? "default") as DiagramApiPayload["theme"],
    customStyles: (doc.customStyles ?? {}) as DiagramApiPayload["customStyles"],
    customCss: doc.customCss ?? "",
    tags: doc.tags ?? [],
    isPublic: doc.isPublic ?? false,
  };

  return <EditorShell initial={initial} />;
}
