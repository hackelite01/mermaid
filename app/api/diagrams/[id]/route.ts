import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { DiagramVersion } from "@/models/DiagramVersion";
import { diagramUpdateSchema } from "@/lib/validators";
import { sanitizeCss } from "@/lib/sanitize-css";

export const runtime = "nodejs";

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isValidId(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const doc = await Diagram.findOne({ _id: params.id, userId: session.user.id });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    code: doc.code,
    theme: doc.theme,
    customStyles: doc.customStyles,
    customCss: doc.customCss ?? "",
    tags: doc.tags ?? [],
    annotations: doc.annotations ?? [],
    isPublic: doc.isPublic ?? false,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isValidId(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = diagramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();

  // Snapshot the previous state before applying the update so version history
  // is the chain of "what was saved before this change".
  const prev = await Diagram.findOne({ _id: params.id, userId: session.user.id });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update = { ...parsed.data };
  if (update.customCss !== undefined) update.customCss = sanitizeCss(update.customCss);

  const updated = await Diagram.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: update },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Persist a version snapshot only when the code actually changed —
  // otherwise small style/title edits would flood history.
  if (update.code !== undefined && update.code !== prev.code) {
    await DiagramVersion.create({
      diagramId: prev._id,
      userId: session.user.id,
      title: prev.title,
      code: prev.code,
      theme: prev.theme,
      customStyles: prev.customStyles,
      customCss: prev.customCss,
    });
    // Cap to the most recent 50 versions per diagram.
    const stale = await DiagramVersion.find({ diagramId: prev._id })
      .sort({ createdAt: -1 })
      .skip(50)
      .select("_id");
    if (stale.length) {
      await DiagramVersion.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }
  }

  return NextResponse.json({
    id: updated._id.toString(),
    title: updated.title,
    code: updated.code,
    theme: updated.theme,
    customStyles: updated.customStyles,
    customCss: updated.customCss ?? "",
    tags: updated.tags ?? [],
    annotations: updated.annotations ?? [],
    isPublic: updated.isPublic ?? false,
    updatedAt: updated.updatedAt,
    createdAt: updated.createdAt,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isValidId(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const result = await Diagram.deleteOne({ _id: params.id, userId: session.user.id });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await DiagramVersion.deleteMany({ diagramId: params.id });
  return NextResponse.json({ ok: true });
}
