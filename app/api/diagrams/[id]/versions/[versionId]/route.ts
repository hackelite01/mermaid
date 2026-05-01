import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { DiagramVersion } from "@/models/DiagramVersion";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; versionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !mongoose.Types.ObjectId.isValid(params.id) ||
    !mongoose.Types.ObjectId.isValid(params.versionId)
  ) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const owns = await Diagram.exists({ _id: params.id, userId: session.user.id });
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const v = await DiagramVersion.findOne({
    _id: params.versionId,
    diagramId: params.id,
  }).lean();
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: v._id.toString(),
    title: v.title,
    code: v.code,
    theme: v.theme,
    customStyles: v.customStyles,
    customCss: v.customCss ?? "",
    label: v.label ?? null,
    createdAt: v.createdAt,
  });
}

/** Restore: copy this version's content back onto the live diagram. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; versionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !mongoose.Types.ObjectId.isValid(params.id) ||
    !mongoose.Types.ObjectId.isValid(params.versionId)
  ) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const v = await DiagramVersion.findOne({
    _id: params.versionId,
    diagramId: params.id,
    userId: session.user.id,
  });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Snapshot current state before restoring so the user can undo.
  const current = await Diagram.findOne({
    _id: params.id,
    userId: session.user.id,
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await DiagramVersion.create({
    diagramId: current._id,
    userId: session.user.id,
    title: current.title,
    code: current.code,
    theme: current.theme,
    customStyles: current.customStyles,
    customCss: current.customCss,
    label: "Auto-snapshot before restore",
  });

  current.title = v.title;
  current.code = v.code;
  current.theme = v.theme as typeof current.theme;
  current.customStyles = v.customStyles;
  current.customCss = v.customCss;
  await current.save();

  return NextResponse.json({
    id: current._id.toString(),
    title: current.title,
    code: current.code,
    theme: current.theme,
    customStyles: current.customStyles,
    customCss: current.customCss ?? "",
  });
}
