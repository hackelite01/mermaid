import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";

export const runtime = "nodejs";

/** Public, unauthenticated read of a diagram. Only returns it if isPublic=true. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();
  const doc = await Diagram.findOne({ _id: params.id, isPublic: true })
    .select("title code theme customStyles customCss updatedAt")
    .lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    code: doc.code,
    theme: doc.theme,
    customStyles: doc.customStyles,
    customCss: doc.customCss ?? "",
    updatedAt: doc.updatedAt,
  });
}
