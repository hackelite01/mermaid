import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signupSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  await connectDB();
  const exists = await User.findOne({ email });
  if (exists) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    password: hash,
    name,
    provider: "credentials",
  });

  return NextResponse.json(
    { id: user._id.toString(), email: user.email, name: user.name ?? null },
    { status: 201 },
  );
}
