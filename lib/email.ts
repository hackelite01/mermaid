/**
 * Minimal email transport. Uses Resend's HTTP API when RESEND_API_KEY is set,
 * otherwise logs the message to the server console — useful for local dev.
 *
 * Swap for SendGrid/SES/Postmark by replacing the body of `sendEmail`.
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // Dev fallback: print to logs so you can copy the link manually.
    // eslint-disable-next-line no-console
    console.log(
      `\n[email] ${input.subject}\n  to:   ${input.to}\n  text: ${input.text}\n  (Set RESEND_API_KEY + EMAIL_FROM to actually deliver email)\n`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function passwordResetEmail({
  resetUrl,
  expiresInMinutes,
}: {
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const text = `Reset your Mermaid Studio password.

Click the link below to set a new password. This link expires in ${expiresInMinutes} minutes and can be used once.

${resetUrl}

If you didn't request a password reset, you can safely ignore this email.`;

  const html = `<!doctype html>
<html><body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <h2 style="margin-top: 0;">Reset your password</h2>
  <p>Click the button below to set a new password for your Mermaid Studio account.</p>
  <p style="margin: 24px 0;">
    <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset password</a>
  </p>
  <p style="font-size: 13px; color: #475569;">This link expires in ${expiresInMinutes} minutes and can be used once. If you didn't request a password reset, you can safely ignore this email.</p>
  <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">${resetUrl}</p>
</body></html>`;

  return { html, text };
}
