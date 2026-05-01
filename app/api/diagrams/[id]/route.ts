import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { diagramUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function ownDiagram(userId: string, id: string) {
  if (!isValidId(id)) return null;
  await connectDB();
  return Diagram.findOne({ _id: id, userId });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await ownDiagram(session.user.id, params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    code: doc.code,
    theme: doc.theme,
    customStyles: doc.customStyles,
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
  const updated = await Diagram.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: parsed.data },
    { new: true },
  );

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: updated._id.toString(),
    title: updated.title,
    code: updated.code,
    theme: updated.theme,
    customStyles: updated.customStyles,
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
  const result = await Diagram.deleteOne({
    _id: params.id,
    userId: session.user.id,
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
