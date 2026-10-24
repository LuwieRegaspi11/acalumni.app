// =====================================================================
// NOTIFY-ALUMNI — sends one message to a group of alumni over up to
// three channels:
//
//   * in-app  — a row in public.notifications for every recipient
//               (shows up in the bell panel live, via Realtime)
//   * email   — one email per recipient through Resend
//   * SMS     — optional; Semaphore (Philippine SMS gateway)
//
// Called from the admin screens only (verified against profiles.role):
//   - Announcements  (shared/AnnouncementContext.tsx -> addAnnouncement)
//   - Events         (shared/EventCalendar.tsx -> handleCreate)
//   - Alumni Tracer  ("Contact batch" in shared/AlumniManagementView.tsx)
//
// Request body:
//   {
//     title:    string,
//     message:  string,
//     channels: { inApp?: boolean, email?: boolean, sms?: boolean },
//     audience: {                       // all optional; combine to narrow
//       department?: string,            // "CSE" | "CTHM" | "BAA" ("All"/"All Alumni" = everyone)
//       batchYear?: number,
//       program?: string,               // e.g. "BSIT"
//       userIds?: string[],             // explicit list of profile ids
//     }
//   }
//
// Provider keys live ONLY in this function's environment (never in the
// browser bundle, never prefixed VITE_). Set them with:
//   supabase secrets set --env-file supabase/functions/.env
// See supabase/functions/.env.example. A channel whose keys are missing is
// reported back as "skipped" — it never makes the whole call fail, so the
// in-app notification still goes out.
//
// Deploy: supabase functions deploy notify-alumni
// (verify_jwt can stay on; the function also checks the caller is an admin.)
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Email provider — set ONE of these (Brevo is free with no domain needed):
//   BREVO_API_KEY  (+ EMAIL_FROM_ADDRESS verified as a sender in Brevo)
//   RESEND_API_KEY (+ EMAIL_FROM on a domain verified in Resend)
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const EMAIL_FROM_ADDRESS = Deno.env.get("EMAIL_FROM_ADDRESS") || "";
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "Asian College Alumni";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || (EMAIL_FROM_ADDRESS ? `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>` : "");
const SEMAPHORE_API_KEY = Deno.env.get("SEMAPHORE_API_KEY") || "";
const SMS_SENDER_NAME = Deno.env.get("SMS_SENDER_NAME") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "";

const MAX_RECIPIENTS = 5000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, res: json({ error: "Missing Authorization header." }, 401) };
  const caller = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data?.user) return { ok: false, res: json({ error: "Invalid or expired session." }, 401) };
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.role !== "admin") return { ok: false, res: json({ error: "Admin access required." }, 403) };
  return { ok: true };
}

interface Recipient {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

async function resolveRecipients(audience: Record<string, unknown>): Promise<Recipient[]> {
  const out: Recipient[] = [];
  const PAGE = 1000;
  for (let from = 0; out.length < MAX_RECIPIENTS; from += PAGE) {
    let q = admin
      .from("profiles")
      .select("id, name, email, phone")
      .in("role", ["alumni", "representative"])
      .eq("registration_status", "approved")
      .neq("active", false)
      .order("id")
      .range(from, from + PAGE - 1);

    const dept = String(audience.department || "").trim();
    if (dept && dept !== "All" && dept !== "All Alumni") q = q.eq("department", dept);
    const batchYear = Number(audience.batchYear);
    if (Number.isInteger(batchYear) && batchYear > 0) q = q.eq("batch_year", batchYear);
    const program = String(audience.program || "").trim();
    if (program) q = q.eq("program", program);
    if (Array.isArray(audience.userIds)) q = q.in("id", (audience.userIds as unknown[]).map(String));

    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out.slice(0, MAX_RECIPIENTS);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emailHtml(title: string, message: string): string {
  const body = escapeHtml(message).replace(/\n/g, "<br>");
  const cta = SITE_URL
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(SITE_URL)}" style="background:#1B3A6B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the Alumni Portal</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
  <div style="background:#1B3A6B;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold">Asian College Alumni</div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
    <p style="margin:0;line-height:1.55;font-size:14px">${body}</p>${cta}
  </div>
  <p style="font-size:11px;color:#9ca3af;text-align:center">You are receiving this because you are a registered Asian College alumnus.</p>
</div>`;
}

async function sendEmails(recipients: Recipient[], title: string, message: string) {
  const useBrevo = !!(BREVO_API_KEY && EMAIL_FROM_ADDRESS);
  const useResend = !useBrevo && !!(RESEND_API_KEY && EMAIL_FROM);
  if (!useBrevo && !useResend) {
    return { sent: 0, failed: 0, skipped: "No email provider configured (set BREVO_API_KEY + EMAIL_FROM_ADDRESS, or RESEND_API_KEY + EMAIL_FROM)" };
  }
  const targets = recipients.filter(r => r.email);
  const html = emailHtml(title, message);
  let sent = 0, failed = 0;

  if (useBrevo) {
    // Brevo sends one message per call; do a few at a time.
    for (let i = 0; i < targets.length; i += 10) {
      const results = await Promise.all(targets.slice(i, i + 10).map(async r => {
        try {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS },
              to: [{ email: r.email, name: r.name || undefined }],
              subject: title, htmlContent: html, textContent: `${title}\n\n${message}`,
            }),
          });
          if (!res.ok) console.error("[notify-alumni] brevo failed", res.status, await res.text());
          return res.ok;
        } catch (err) {
          console.error("[notify-alumni] brevo threw", err);
          return false;
        }
      }));
      results.forEach(ok => (ok ? sent++ : failed++));
    }
    return { sent, failed };
  }

  for (let i = 0; i < targets.length; i += 100) {
    const batch = targets.slice(i, i + 100).map(r => ({
      from: EMAIL_FROM, to: [r.email as string], subject: title, html, text: `${title}\n\n${message}`,
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else { failed += batch.length; console.error("[notify-alumni] resend failed", res.status, await res.text()); }
    } catch (err) {
      failed += batch.length;
      console.error("[notify-alumni] resend threw", err);
    }
  }
  return { sent, failed };
}

// Profile phones are stored as typed in PhoneNumberField ("9XX XXX XXXX"),
// but older rows may hold 09XXXXXXXXX or +639XXXXXXXXX. Semaphore wants
// 639XXXXXXXXX (or 09XXXXXXXXX).
function normalizePhone(raw: string | null): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("9")) return `63${d}`;
  if (d.length === 11 && d.startsWith("09")) return `63${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("639")) return d;
  return null;
}

async function sendSms(recipients: Recipient[], title: string, message: string) {
  if (!SEMAPHORE_API_KEY) return { sent: 0, failed: 0, skipped: "SEMAPHORE_API_KEY not configured" };
  const numbers = recipients.map(r => normalizePhone(r.phone)).filter((n): n is string => !!n);
  if (numbers.length === 0) return { sent: 0, failed: 0, skipped: "No recipient has a valid mobile number" };
  const text = `Asian College Alumni: ${title}. ${message}`.slice(0, 300);
  let sent = 0, failed = 0;
  for (let i = 0; i < numbers.length; i += 500) {
    const chunk = numbers.slice(i, i + 500);
    const form = new URLSearchParams({ apikey: SEMAPHORE_API_KEY, number: chunk.join(","), message: text });
    if (SMS_SENDER_NAME) form.set("sendername", SMS_SENDER_NAME);
    try {
      const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body: form });
      if (res.ok) sent += chunk.length;
      else { failed += chunk.length; console.error("[notify-alumni] semaphore failed", res.status, await res.text()); }
    } catch (err) {
      failed += chunk.length;
      console.error("[notify-alumni] semaphore threw", err);
    }
  }
  return { sent, failed };
}

async function sendInApp(recipients: Recipient[], title: string, message: string) {
  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += 500) {
    // skip_email: this function already sends email itself (when the admin ticked
    // it), so the notifications -> email trigger must not send a duplicate.
    const rows = recipients.slice(i, i + 500).map(r => ({ user_id: r.id, title, message, type: "info", skip_email: true }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) { failed += rows.length; console.error("[notify-alumni] notifications insert failed", error); }
    else sent += rows.length;
  }
  return { sent, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const title = String(body?.title || "").trim().slice(0, 200);
  const message = String(body?.message || "").trim().slice(0, 4000);
  if (!title || !message) return json({ error: "title and message are required." }, 400);

  const channels = body?.channels || {};
  if (!channels.inApp && !channels.email && !channels.sms) {
    return json({ error: "Choose at least one channel." }, 400);
  }

  try {
    const recipients = await resolveRecipients(body?.audience || {});
    const result: Record<string, unknown> = { recipients: recipients.length };
    if (recipients.length === 0) return json({ ...result, note: "No alumni matched this audience." });

    if (channels.inApp) result.inApp = await sendInApp(recipients, title, message);
    if (channels.email) result.email = await sendEmails(recipients, title, message);
    if (channels.sms) result.sms = await sendSms(recipients, title, message);
    return json(result);
  } catch (err) {
    console.error("[notify-alumni] unexpected error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error." }, 500);
  }
});
