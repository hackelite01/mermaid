import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { shareSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await connectDB();
  const updated = await Diagram.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: { isPublic: parsed.data.isPublic } },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id: updated._id.toString(), isPublic: updated.isPublic });
}
