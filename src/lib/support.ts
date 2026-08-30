/**
 * The address a person is told to write to when something went wrong with
 * money. One constant, because it appears in the Terms, in the Privacy
 * notice and — since 30.08.2026 — on the page a buyer lands on when their
 * payment did not turn into access, and those three must never drift into
 * two different mailboxes.
 *
 * Not `server-only`: the post-checkout notice is a client component.
 */
export const SUPPORT_EMAIL = "support@rusofacilapp.com";
