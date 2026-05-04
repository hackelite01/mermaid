import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PasswordReset } from "@/models/PasswordReset";
import { forgotPasswordSchema } from "@/lib/validators";
import { passwordResetEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const TOKEN_TTL_MIN = 30;
const RESEND_THROTTLE_SEC = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Generic response — don't leak whether the email is registered.
  const generic = NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, we've sent a reset link. Check your inbox.",
  });

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user || user.provider !== "credentials") {
    // Pause briefly so timing doesn't leak account existence.
    await new Promise((r) => setTimeout(r, 150));
    return generic;
  }

  // Throttle: refuse to issue a new token if a recent one is still fresh.
  const recent = await PasswordReset.findOne({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();
  if (
    recent &&
    Date.now() - new Date(recent.createdAt).getTime() < RESEND_THROTTLE_SEC * 1000
  ) {
    return generic;
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

  // Replace any existing tokens — only one valid reset link at a time.
  await PasswordReset.deleteMany({ userId: user._id });
  await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

  const baseUrl =
    process.env.NEXTAUTH_URL ?? new URL(req.url).origin.replace(/\/$/, "");
  const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(
    rawToken,
  )}`;

  try {
    const { html, text } = passwordResetEmail({
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MIN,
    });
    await sendEmail({
      to: user.email,
      subject: "Reset your Mermaid Studio password",
      html,
      text,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[forgot-password] email send failed:", err);
    // Still return generic so we don't leak the failure to attackers.
  }

  return generic;
}
