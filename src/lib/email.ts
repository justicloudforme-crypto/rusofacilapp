import "server-only";
import { Resend } from "resend";

// Transactional email only (password reset, account-deletion confirmation)
// — never bulk/marketing mail, so the free Resend tier (100/day, 3,000/mo)
// comfortably covers this app's scale. Same "leave blank to run in demo
// mode" convention as Stripe/OpenAI/Anthropic in .env.example: with no API
// key set, this logs the email to the server console instead of sending it
// — lets password-reset/account-deletion be built and tested end-to-end
// locally without a Resend account, and fails safe (never throws) if the
// key is missing in a deployed environment too.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "RusoFácilapp <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:demo-mode] to=${to} subject="${subject}"\n${html}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    // Never throw from here — a failed email must not surface as a 500 on
    // routes that already responded with a generic "check your inbox"
    // message (forgot-password, delete-account) to avoid leaking whether
    // the address exists. The console log is this app's only failure
    // signal for now; revisit if email delivery ever needs to be monitored.
    console.error("[email] send failed:", error);
  }
}
