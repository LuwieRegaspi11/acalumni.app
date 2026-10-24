// =====================================================================
// EMAIL-NOTIFICATION — emails every in-app notification to its recipient,
// so alumni, batch reps and the admin don't have to open their account to
// find out something happened (offers, donation verified/rejected, a new
// donation waiting for the admin, offer answers, and so on).
//
// How it is triggered: a database trigger on public.notifications
// (supabase/email_notifications.sql) POSTs each new row to this function.
// Rows the notify-alumni function already emailed itself (announcements,
// events, "Contact batch") carry skip_email = true and are ignored here, so
// nobody gets two copies.
//
// Free email provider — set ONE (see supabase/functions/.env.example):
//   Brevo  (300 emails/day free, no domain needed — just verify one sender
//           address): BREVO_API_KEY + EMAIL_FROM_ADDRESS (+ EMAIL_FROM_NAME)
//   Resend (needs a verified domain to email other people):
//           RESEND_API_KEY + EMAIL_FROM
// Also required: WEBHOOK_SECRET (same value as in the SQL file) and, for the
// button in the email, SITE_URL.
//
// Deploy with JWT verification OFF (the database trigger has no user JWT; the
// shared secret below is what protects this function):
//   supabase functions deploy email-notification --no-verify-jwt
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const EMAIL_FROM_ADDRESS = Deno.env.get("EMAIL_FROM_ADDRESS") || "";
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "Asian College Alumni";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || (EMAIL_FROM_ADDRESS ? `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>` : "");
const SITE_URL = Deno.env.get("SITE_URL") || "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emailHtml(firstName: string, title: string, message: string): string {
  const cta = SITE_URL
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(SITE_URL)}" style="background:#1B3A6B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the Alumni Portal</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
  <div style="background:#1B3A6B;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold">Asian College Alumni</div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <p style="margin:0 0 12px;font-size:14px">Hi ${escapeHtml(firstName)},</p>
    <h2 style="margin:0 0 10px;font-size:18px">${escapeHtml(title)}</h2>
    <p style="margin:0;line-height:1.55;font-size:14px">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280">Sign in to the Alumni Portal to view this and respond.</p>${cta}
  </div>
  <p style="font-size:11px;color:#9ca3af;text-align:center">You received this because you have an Asian College Alumni Portal account.</p>
</div>`;
}

async function sendOne(to: string, toName: string, subject: string, html: string, text: string): Promise<boolean> {
  if (BREVO_API_KEY && EMAIL_FROM_ADDRESS) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS },
        to: [{ email: to, name: toName || undefined }],
        subject, htmlContent: html, textContent: text,
      }),
    });
    if (!res.ok) console.error("[email-notification] brevo failed", res.status, await res.text());
    return res.ok;
  }
  if (RESEND_API_KEY && EMAIL_FROM) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("[email-notification] resend failed", res.status, await res.text());
    return res.ok;
  }
  console.error("[email-notification] no email provider configured");
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "Unauthorized." }, 401);
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  const rec = payload?.record;
  if (payload?.type !== "INSERT" || !rec?.user_id || !rec?.title) return json({ skipped: "not a new notification" });
  if (rec.skip_email) return json({ skipped: "already emailed by notify-alumni" });

  const { data: profile } = await admin
    .from("profiles")
    .select("name, email, active, registration_status")
    .eq("id", rec.user_id)
    .maybeSingle();

  if (!profile?.email) return json({ skipped: "recipient has no email" });
  if (profile.active === false || profile.registration_status === "rejected") return json({ skipped: "recipient account is not active" });

  const firstName = String(profile.name || "").trim().split(/\s+/)[0] || "there";
  const message = String(rec.message || "");
  const ok = await sendOne(
    profile.email, profile.name || "", String(rec.title),
    emailHtml(firstName, String(rec.title), message),
    `Hi ${firstName},\n\n${rec.title}\n\n${message}\n\nSign in to the Alumni Portal to view this and respond.${SITE_URL ? `\n${SITE_URL}` : ""}`,
  );
  return json({ sent: ok });
});
