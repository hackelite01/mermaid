import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Diagram } from "@/models/Diagram";
import { diagramCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  await connectDB();

  const filter: Record<string, unknown> = { userId: session.user.id };
  if (q) {
    filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const diagrams = await Diagram.find(filter)
    .sort({ updatedAt: -1 })
    .select("title theme updatedAt createdAt")
    .lean();

  return NextResponse.json({
    diagrams: diagrams.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      theme: d.theme,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = diagramCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();
  const created = await Diagram.create({
    ...parsed.data,
    userId: session.user.id,
  });

  return NextResponse.json(
    {
      id: created._id.toString(),
      title: created.title,
      code: created.code,
      theme: created.theme,
      customStyles: created.customStyles,
      updatedAt: created.updatedAt,
      createdAt: created.createdAt,
    },
    { status: 201 },
  );
}
