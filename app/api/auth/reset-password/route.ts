import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";
import { resetPasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");

  await connectDB();
  const record = await PasswordReset.findOne({ tokenHash });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const user = await User.findById(record.userId).select("+password");
  if (!user) {
    await PasswordReset.deleteOne({ _id: record._id });
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  user.password = await bcrypt.hash(parsed.data.password, 12);
  await user.save();

  // Invalidate all reset tokens for this user.
  await PasswordReset.deleteMany({ userId: user._id });

  return NextResponse.json({ ok: true });
}
