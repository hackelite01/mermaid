import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { DiagramVersion } from "@/models/DiagramVersion";
import { versionCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const owns = await Diagram.exists({ _id: params.id, userId: session.user.id });
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await DiagramVersion.find({ diagramId: params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v._id.toString(),
      title: v.title,
      code: v.code,
      theme: v.theme,
      customStyles: v.customStyles,
      customCss: v.customCss ?? "",
      label: v.label ?? null,
      createdAt: v.createdAt,
    })),
  });
}

/** Manually create a labeled snapshot of the current diagram state. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = versionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await connectDB();
  const doc = await Diagram.findOne({ _id: params.id, userId: session.user.id });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const v = await DiagramVersion.create({
    diagramId: doc._id,
    userId: session.user.id,
    title: doc.title,
    code: doc.code,
    theme: doc.theme,
    customStyles: doc.customStyles,
    customCss: doc.customCss,
    label: parsed.data.label,
  });

  return NextResponse.json(
    {
      id: v._id.toString(),
      label: v.label ?? null,
      createdAt: v.createdAt,
    },
    { status: 201 },
  );
}
