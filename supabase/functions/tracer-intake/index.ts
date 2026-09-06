// =====================================================================
// TRACER-INTAKE — the only place in this app allowed to create an
// alumni login. Backs two flows:
//
//   { action: "submit", payload }
//     Public, no auth required — called from
//     alumni/PublicTracerSurveyPage.tsx right after someone finishes
//     the Alumni Tracer Survey with no account yet. EVERY new submission
//     gets a real login immediately (generated password, returned once
//     in the response body for the one-time reveal screen) and a
//     `graduate_tracer_responses` row. If the submitted First Name +
//     Last Name + Department + Program match a row in `alumni_roster`
//     (the admin-imported list of known graduates), the new account is
//     created straight at registration_status='approved' — signing in
//     goes straight to the dashboard. Otherwise it starts 'pending' —
//     signing in lands on the existing pending-approval status page
//     (same one any other pending account gets) until an admin clears
//     it in Pending Registrations. Either way the account and its
//     credentials already exist right away; nothing about logging in is
//     ever blocked, only dashboard access. The roster match
//     (matched_roster_id) is kept either way as an audit trail.
//     If the submitted email already belongs to an existing account and
//     the submitted Name + Department + Program match what's on file
//     for it, that account is treated as already verified — its
//     password is reset automatically and handed back the same way a
//     brand-new account's would be (most commonly because the record
//     came from an admin import and the alumnus never received their
//     original credentials). Its registration_status is left exactly as
//     it was (an already-approved account stays approved; a still-
//     pending one stays pending) — this only ever resets a password, it
//     never grants dashboard access an admin hasn't. If the identity
//     DOESN'T match, nothing is touched — see the "possible duplicate"
//     queue below; only an admin can confirm and reset it from there.
//
//   { action: "approve" | "reject", intakeId, reason? }
//     Admin-only (the caller's JWT is checked against profiles.role).
//     Called from admin/PendingRegistrations.tsx. Since the account
//     already exists in the normal case, "approve" is just flipping
//     registration_status to 'approved' — there's no password left to
//     relay, the alumnus already got their own the moment they
//     submitted. "reject" flips it to 'rejected', which (per
//     AuthContext.tsx's login()) blocks sign-in entirely from then on.
//     Two exceptions on approve, both returning a fresh password to
//     relay: if account creation itself failed back at submission time
//     (rare — see handleSubmit's catch block), this creates the account
//     for the first time here instead; if this intake was queued as a
//     "possible duplicate" (an existing account's email, but identity
//     that couldn't be auto-verified — see handleSubmit), approving
//     means the admin vouches it's really that person, resetting their
//     password.
//
//   { action: "bulk_import", rows }
//     Admin-only. See handleBulkImport's own header comment.
//
//   { action: "admin_update_contact", profileId, ... }
//     Admin-only. Called from shared/AlumniManagementView.tsx's per-row
//     Edit button — corrects an alumnus's contact details (email,
//     mobile number, addresses, social network ID), including the
//     actual Auth sign-in email if it's changing. See
//     handleAdminUpdateContact's own header comment.
//
// This has to be an Edge Function (not a client-side call) because
// creating a Supabase Auth user requires the service_role key, which
// must never reach the browser — see scripts/import-alumni.mjs's header
// comment for the same reasoning. `alumni_roster` and
// `alumni_tracer_intake` also have no RLS policy that lets an anonymous
// visitor read/write them at all (see supabase/alumni_tracer_intake.sql)
// — this function's service_role client is the only writer.
//
// Deploy: mcp__claude_ai_Supabase__deploy_edge_function, verify_jwt:
// false (public "submit" callers have no session at all; "approve"/
// "reject" verify admin-ness themselves via the Authorization header).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

// service_role client — bypasses RLS entirely. Never constructed with
// anything but the service_role key, and never returned/exposed to a caller.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------
// Password generator — at least one char from each class, 14 chars
// total, cryptographically random. Comfortably clears
// AuthPage.tsx's isPasswordStrong() (8+ chars, upper, lower, digit,
// special). Ambiguous-looking characters (0/O, 1/l/I) are excluded so a
// person copying it by hand/eye doesn't mistype it.
// ---------------------------------------------------------------------
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_+=";

function secureRandomFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xffffffff + 1);
}
function randomFrom(pool: string): string {
  return pool[Math.floor(secureRandomFloat() * pool.length)];
}
function generatePassword(length = 14): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [randomFrom(UPPER), randomFrom(LOWER), randomFrom(DIGITS), randomFrom(SYMBOLS)];
  while (chars.length < length) chars.push(randomFrom(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandomFloat() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------------------------------------------------------------------
// employment_status mapping: the Graduate Tracer Survey's 10 granular
// values (lib/graduateTracerSurveyOptions.ts's EMPLOYMENT_STATUS_OPTIONS,
// copied from the official survey document) collapse onto
// profiles.employment_status's 4-value check constraint
// ('Employed' | 'Unemployed' | 'Self-Employed' | 'Pursuing Studies').
// "Preparing for Licensure Examination" is a judgment call -> Unemployed
// (closer in spirit than "Pursuing Studies", which is specifically about
// further/graduate studies).
// ---------------------------------------------------------------------
const EMPLOYMENT_STATUS_MAP: Record<string, string> = {
  "Employed (Full-Time)": "Employed",
  "Employed (Part-Time)": "Employed",
  "Contract-Based Worker": "Employed",
  "Self-Employed": "Self-Employed",
  "Business Owner": "Self-Employed",
  "Freelancer": "Self-Employed",
  "Pursuing Graduate Studies": "Pursuing Studies",
  "Preparing for Licensure Examination": "Unemployed",
  "Currently Unemployed (Seeking Employment)": "Unemployed",
  "Currently Unemployed (Not Seeking Employment)": "Unemployed",
};
function mapEmploymentStatus(v: unknown): string {
  return EMPLOYMENT_STATUS_MAP[String(v || "")] || "Unemployed";
}

function avatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`;
}

// Every graduate_tracer_responses column this flow can populate, minus
// id/respondent_id/status/submitted_at/updated_at — identical set on
// alumni_tracer_intake (see supabase/alumni_tracer_intake.sql). Both the
// public submission payload (already shaped this way by
// tracerSurveySections.tsx's answersToRow()) and an existing intake row
// (already a DB row) use these exact keys, so one picker works for both.
const ANSWER_COLUMNS = [
  "first_name", "last_name", "date_of_birth", "email",
  "mobile_number", "social_network_id", "current_address", "permanent_address",
  "sex", "civil_status", "year_graduated", "college_department", "program_graduated",
  "employment_status", "employment_classification",
  "company_organization", "job_title", "job_classification", "job_classification_other",
  "industry_sector", "industry_sector_other", "job_related_to_degree", "time_to_first_job",
  "number_of_employers", "reasons_for_leaving_job", "reasons_for_leaving_job_other",
  "monthly_salary_range", "first_job_source", "first_job_source_other", "current_work_location",
  "job_satisfaction_rating", "job_securing_factors", "job_securing_factors_other",
  "education_quality_rating", "program_relevance", "competency_ratings",
  "employability_experiences", "employability_experiences_other",
  "areas_to_strengthen", "areas_to_strengthen_other", "training_satisfaction_rating",
  "licensure_exam_status", "has_certifications", "certifications_detail",
  "has_professional_training", "professional_training_detail",
  "interested_in_alumni_activities", "preferred_alumni_activities", "preferred_alumni_activities_other",
  "program_improvements", "program_improvements_other",
  "additional_services_needed", "additional_services_needed_other",
  "would_recommend_college", "additional_comments",
] as const;

function pickAnswerColumns(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ANSWER_COLUMNS) out[key] = src[key] ?? null;
  return out;
}

// Lighter-weight than tracerSurveySections.tsx's buildRequirements('public')
// on purpose — that engine (min-3 selections, "specify Other", etc.) is
// the canonical UX validator already enforced client-side before this
// function is ever called. This is a defensive backstop against a
// garbage/incomplete request hitting the function directly, not a
// second copy of the full rulebook.
const REQUIRED_FIELDS = [
  "first_name", "last_name", "date_of_birth", "email",
  "mobile_number", "current_address", "permanent_address", "sex", "civil_status",
  "year_graduated", "college_department", "program_graduated",
  "employment_status", "employment_classification",
  "education_quality_rating", "program_relevance", "licensure_exam_status",
  "has_certifications", "has_professional_training", "interested_in_alumni_activities",
  "would_recommend_college", "additional_comments",
];
function findMissingFields(payload: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS.filter(key => {
    const v = payload[key];
    return v === undefined || v === null || String(v).trim() === "";
  });
}

// ---------------------------------------------------------------------
// Shared account-creation steps — used by every submission (matched or
// not — see handleSubmit) and by handleBulkImport/handleReview's rare
// fallback path. `source` is either the public payload or an existing
// alumni_tracer_intake row; both are keyed identically (see
// ANSWER_COLUMNS above). `opts.approved` decides whether this account
// can reach its dashboard right away (registration_status='approved')
// or lands on the pending-approval status page on sign-in until an
// admin clears it (registration_status='pending') — the account itself
// and its login always exist either way.
// ---------------------------------------------------------------------
async function provisionAccount(source: Record<string, unknown>, opts: { approved: boolean }): Promise<
  | { ok: true; email: string; password: string; name: string; userId: string; responseId: string | null }
  | { ok: false; error: string }
> {
  const email = String(source.email || "").trim().toLowerCase();
  const firstName = String(source.first_name || "").trim();
  const lastName = String(source.last_name || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") || email;

  if (!email) return { ok: false, error: "Missing email — cannot create an account." };

  const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existingProfile) return { ok: false, error: "This email already has an account. Please sign in instead." };

  const password = generatePassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      department: source.college_department || null,
      program: source.program_graduated || null,
      batch_year: source.year_graduated || null,
      phone: source.mobile_number || null,
      address: source.current_address || null,
      date_of_birth: source.date_of_birth || null,
      profile_image: avatarUrl(name),
    },
  });
  if (createErr || !created?.user) {
    return { ok: false, error: createErr?.message || "Could not create the account." };
  }
  const userId = created.user.id;

  // handle_new_user() already inserted the initial profiles row (as
  // registration_status='pending', the same as any signup) — promote it
  // and fill in the fields that trigger doesn't cover (the live
  // handle_new_user() as of this writing doesn't copy date_of_birth from
  // metadata at all, so it's set explicitly here too). Best-effort past
  // this point: the login itself is already valid, so a failure here is
  // logged, not surfaced as a failure to the caller (matches the
  // "create, then promote" two-step already used by scripts/import-alumni.mjs).
  const { error: profileErr } = await admin.from("profiles").update({
    registration_status: opts.approved ? "approved" : "pending",
    active: true,
    must_change_password: true,
    date_of_birth: source.date_of_birth || null,
    current_company: source.company_organization || null,
    current_position: source.job_title || null,
    employment_status: mapEmploymentStatus(source.employment_status),
  }).eq("id", userId);
  if (profileErr) console.error("[tracer-intake] profile promotion failed", userId, profileErr);

  let responseId: string | null = null;
  const { data: responseRow, error: responseErr } = await admin
    .from("graduate_tracer_responses")
    .insert({
      respondent_id: userId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ...pickAnswerColumns(source),
    })
    .select("id")
    .single();
  if (responseErr) console.error("[tracer-intake] graduate_tracer_responses insert failed", userId, responseErr);
  else responseId = responseRow.id;

  return { ok: true, email, password, name, userId, responseId };
}

// Extracts the first and last whitespace-separated tokens from a stored
// "First [Middle] Last" name (see provisionAccount's `name` construction)
// and compares both case-insensitively — used only to annotate a
// resubmission queued for manual admin review with whether the claimed
// identity looks right (see handleSubmit below). This is a hint for the
// admin, never a substitute for their sign-off: name/department/program
// alone are guessable and are never enough on their own to touch an
// existing account's password.
function nameMatches(storedFullName: unknown, submittedFirstLower: string, submittedLastLower: string): boolean {
  const parts = String(storedFullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || !submittedFirstLower || !submittedLastLower) return false;
  return parts[0].toLowerCase() === submittedFirstLower && parts[parts.length - 1].toLowerCase() === submittedLastLower;
}

// Every new-email submission gets an account and a login immediately.
// A roster match (First Name + Last Name + Department + Program against
// `alumni_roster`) creates it straight at registration_status='approved'
// — signing in goes straight to the dashboard; otherwise it starts
// 'pending' until an admin clears it in Pending Registrations. This is
// the one place a brand-new account gets created.
async function handleSubmit(payload: Record<string, unknown>): Promise<Response> {
  const missing = findMissingFields(payload);
  if (missing.length > 0) {
    return json({ error: `Missing required field(s): ${missing.join(", ")}` }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const firstName = String(payload.first_name || "").trim();
  const lastName = String(payload.last_name || "").trim();
  const department = String(payload.college_department || "").trim();
  const program = String(payload.program_graduated || "").trim();

  const { data: existingProfile } = await admin.from("profiles")
    .select("id, name, department, program, registration_status")
    .eq("email", email).maybeSingle();
  if (existingProfile) {
    // This happens whenever someone whose data is already in the system
    // (most commonly a historical record brought in via an admin import —
    // scripts/import-alumni.mjs or admin/BulkImportResponses.tsx — or an
    // earlier tracer submission of their own) resubmits the public
    // survey, often because they never received their original
    // credentials and assumed submitting again was how to get in. A
    // rejected account never qualifies — that was a deliberate admin
    // decision, not something to route around.
    if (existingProfile.registration_status === "rejected") {
      return json({ error: "This email already has an account. Please sign in instead — if your name, department, or program don't match what's on file, contact the Alumni Office." }, 409);
    }

    // The closest this flow gets to proving the submitter really owns
    // this account without a human in the loop. Reset automatically when
    // it matches — this account's own registration_status is left
    // exactly as it was (approved stays approved, pending stays
    // pending), so this only ever hands back a working password, never
    // dashboard access an admin hasn't already granted. When it DOESN'T
    // match, fall through to the manual-review queue below instead —
    // never touch an existing account's password on an unverified claim.
    const identityLooksRight =
      nameMatches(existingProfile.name, firstName.toLowerCase(), lastName.toLowerCase()) &&
      !!existingProfile.department && existingProfile.department.toLowerCase() === department.toLowerCase() &&
      !!existingProfile.program && existingProfile.program.toLowerCase() === program.toLowerCase();

    if (identityLooksRight) {
      const newPassword = generatePassword();
      const { error: pwErr } = await admin.auth.admin.updateUserById(existingProfile.id, { password: newPassword });
      if (pwErr) {
        // Fall back to the manual-review queue rather than silently
        // failing — the submission still isn't lost.
        await admin.from("alumni_tracer_intake").insert({
          status: "pending",
          possible_duplicate_profile_id: existingProfile.id,
          notes: `Identity matched on resubmission, but the automatic password reset failed (${pwErr.message}) — needs manual admin confirmation.`,
          ...pickAnswerColumns(payload),
        });
        return json({ review: true, message: "We found an account under this email already. Your submission has been sent to the Alumni Office for manual review — you'll be able to sign in with a new password once they verify it." });
      }
      const { error: profErr } = await admin.from("profiles").update({ must_change_password: true }).eq("id", existingProfile.id);
      if (profErr) console.error("[tracer-intake] identity-matched auto-reset: profile update failed", existingProfile.id, profErr);

      const refreshed = await updateExistingRecord(existingProfile.id, payload);
      if (!refreshed.ok) console.error("[tracer-intake] identity-matched auto-reset: survey refresh failed", existingProfile.id, refreshed.error);
      const fallbackName = [firstName, lastName].filter(Boolean).join(" ") || email;

      await admin.from("alumni_tracer_intake").insert({
        status: "approved",
        possible_duplicate_profile_id: existingProfile.id,
        linked_profile_id: existingProfile.id,
        linked_response_id: refreshed.ok ? refreshed.responseId : null,
        reviewed_at: new Date().toISOString(),
        notes: "Auto-reset: submitted Name/Department/Program matched what was already on file, so the account's password was reset automatically without admin review.",
        ...pickAnswerColumns(payload),
      });

      return json({
        matched: existingProfile.registration_status === "approved",
        reset: true,
        email: refreshed.ok ? refreshed.email : email,
        password: newPassword,
        name: refreshed.ok ? refreshed.name : fallbackName,
      });
    }

    // Identity doesn't match what's on file — never reset an existing
    // account's password from an unverified claim (name/department/
    // program alone are guessable/often public: yearbooks, LinkedIn, a
    // leaked roster CSV). Queue it for a human to confirm instead — only
    // an admin manually vouching for it ever resets a password from here
    // (see handleReview's "possible duplicate" branch, the only other
    // place that happens).
    await admin.from("alumni_tracer_intake").insert({
      status: "pending",
      possible_duplicate_profile_id: existingProfile.id,
      notes: "This email already has an account, but the submitted Name/Department/Program didn't fully match what's on file — needs manual admin confirmation before any password reset.",
      ...pickAnswerColumns(payload),
    });
    return json({ review: true, message: "We found an account under this email already. Your submission has been sent to the Alumni Office for manual review — you'll be able to sign in with a new password once they verify it." });
  }

  // Roster match: exact (case-insensitive) First Name + Last Name +
  // Department + Program against `alumni_roster` — replaces the old
  // Student/Alumni ID + Last Name key now that the survey no longer
  // collects an ID number. `.ilike()` with no wildcards is a
  // case-insensitive equality check. A match auto-approves the new
  // account (recorded via matched_roster_id as an audit trail either
  // way) — no match starts it at registration_status='pending' and
  // needs an explicit admin Approve.
  const { data: rosterMatches } = await admin
    .from("alumni_roster")
    .select("id")
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .ilike("department", department)
    .ilike("program", program)
    .limit(1);
  const matchedRosterId: string | null = rosterMatches?.[0]?.id ?? null;
  const approved = !!matchedRosterId;

  try {
    const result = await provisionAccount(payload, { approved });
    if (!result.ok) {
      // Account creation itself failed (e.g. Supabase rejected the
      // email outright) — save the answers so they aren't lost, but
      // there's no login to hand back this time. An admin can create
      // the account by hand later from Pending Registrations (see
      // handleReview's approve, which creates it there if it's still
      // missing) — surface that plainly instead of a silent success.
      await admin.from("alumni_tracer_intake").insert({
        status: "pending",
        notes: `Automatic account creation failed: ${result.error}`,
        matched_roster_id: matchedRosterId,
        ...pickAnswerColumns(payload),
      });
      return json({ error: "We couldn't automatically create your account. Your responses were saved — please contact the Alumni Office." }, 500);
    }
    await admin.from("alumni_tracer_intake").insert({
      status: approved ? "approved" : "pending",
      matched_roster_id: matchedRosterId,
      linked_profile_id: result.userId,
      linked_response_id: result.responseId,
      reviewed_at: approved ? new Date().toISOString() : null,
      ...pickAnswerColumns(payload),
    });
    return json({ matched: approved, email: result.email, password: result.password, name: result.name });
  } catch (err) {
    console.error("[tracer-intake] unexpected error provisioning account", err);
    await admin.from("alumni_tracer_intake").insert({
      status: "pending",
      notes: `Unexpected error while provisioning: ${err instanceof Error ? err.message : String(err)}`,
      matched_roster_id: matchedRosterId,
      ...pickAnswerColumns(payload),
    });
    return json({ error: "Something went wrong saving your survey. Please try again or contact the Alumni Office." }, 500);
  }
}

async function requireAdmin(req: Request): Promise<{ ok: true; adminId: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, res: json({ error: "Missing Authorization header." }, 401) };

  const caller = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userErr } = await caller.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, res: json({ error: "Invalid or expired session." }, 401) };

  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.role !== "admin") return { ok: false, res: json({ error: "Admin access required." }, 403) };
  return { ok: true, adminId: userData.user.id };
}

async function handleReview(req: Request, body: any, kind: "approve" | "reject"): Promise<Response> {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const intakeId = body?.intakeId;
  if (!intakeId) return json({ error: "intakeId is required." }, 400);

  const { data: intake, error: fetchErr } = await admin
    .from("alumni_tracer_intake")
    .select("*")
    .eq("id", intakeId)
    .maybeSingle();
  if (fetchErr || !intake) return json({ error: "Submission not found." }, 404);
  if (intake.status !== "pending") return json({ error: `This submission is already ${intake.status}.` }, 409);

  if (kind === "reject") {
    // The account already exists (every submission gets one at intake
    // time — see handleSubmit) and can currently sign in as far as
    // "pending"; actively lock it out the same way any rejected
    // account is (see AuthContext.tsx's login(), which signs a
    // rejected account straight back out).
    if (intake.linked_profile_id) {
      const { error: profErr } = await admin.from("profiles").update({ registration_status: "rejected" }).eq("id", intake.linked_profile_id);
      if (profErr) console.error("[tracer-intake] reject: profile update failed", intake.linked_profile_id, profErr);
    }
    const { error } = await admin.from("alumni_tracer_intake").update({
      status: "rejected",
      rejection_reason: body?.reason || null,
      reviewed_by: guard.adminId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", intakeId);
    if (error) return json({ error: "Could not update the submission." }, 500);
    return json({ ok: true });
  }

  // Approve. The common case: this submission already has a real
  // account (created at submission time, per handleSubmit) sitting at
  // registration_status='pending' — there's no new password to
  // generate or relay, the alumnus already got their own credentials
  // the moment they submitted the survey. Approving here just lifts
  // the pending gate.
  if (intake.linked_profile_id) {
    const { error: profErr } = await admin.from("profiles").update({ registration_status: "approved", active: true }).eq("id", intake.linked_profile_id);
    if (profErr) return json({ error: "Could not approve this account." }, 500);
    await admin.from("alumni_tracer_intake").update({
      status: "approved",
      reviewed_by: guard.adminId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", intakeId);
    return json({ ok: true, hadExistingAccount: true });
  }

  // "Possible duplicate": handleSubmit couldn't automatically confirm
  // this submission belongs to the existing account under its email
  // (Name/Department/Program didn't fully match), so it
  // queued here instead of resetting anything on its own. The admin
  // looking at the full submitted survey just vouched for it by
  // approving — reset that account's password now, and refresh its
  // survey answers with what was just submitted, exactly like the
  // auto-verified reset in handleSubmit would have.
  if (intake.possible_duplicate_profile_id) {
    const targetId = intake.possible_duplicate_profile_id;
    const newPassword = generatePassword();
    const { error: pwErr } = await admin.auth.admin.updateUserById(targetId, { password: newPassword });
    if (pwErr) return json({ error: `Could not reset the password: ${pwErr.message}` }, 500);
    const { error: profErr } = await admin.from("profiles").update({ registration_status: "approved", active: true, must_change_password: true }).eq("id", targetId);
    if (profErr) return json({ error: "Could not approve this account." }, 500);

    const refreshed = await updateExistingRecord(targetId, intake);
    if (!refreshed.ok) console.error("[tracer-intake] possible-duplicate approve: survey refresh failed", targetId, refreshed.error);
    const fallbackName = [intake.first_name, intake.last_name].filter(Boolean).join(" ") || intake.email;

    await admin.from("alumni_tracer_intake").update({
      status: "approved",
      linked_profile_id: targetId,
      linked_response_id: refreshed.ok ? refreshed.responseId : null,
      reviewed_by: guard.adminId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", intakeId);

    return json({
      email: refreshed.ok ? refreshed.email : intake.email,
      password: newPassword,
      name: refreshed.ok ? refreshed.name : fallbackName,
      userId: targetId,
      hadExistingAccount: true,
      wasReset: true,
    });
  }

  // Rare fallback: account creation failed back at submission time
  // (see handleSubmit's catch block) and this intake row was never
  // linked to one — create it now, and this time there IS a fresh
  // password to relay.
  const result = await provisionAccount(intake, { approved: true });
  if (!result.ok) return json({ error: result.error }, 409);

  const { error: updateErr } = await admin.from("alumni_tracer_intake").update({
    status: "approved",
    matched_roster_id: intake.matched_roster_id ?? null,
    linked_profile_id: result.userId,
    linked_response_id: result.responseId,
    reviewed_by: guard.adminId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", intakeId);
  if (updateErr) console.error("[tracer-intake] intake approval update failed", intakeId, updateErr);

  return json({ email: result.email, password: result.password, name: result.name, userId: result.userId, hadExistingAccount: false });
}

// ---------------------------------------------------------------------
// { action: "admin_update_contact", profileId, email?, mobile_number?,
//   social_network_id?, current_address?, permanent_address? }
// — admin-only. Backs shared/AlumniManagementView.tsx's per-row Edit
// button on the Alumni Tracer page: lets an admin correct an alumnus's
// contact details directly — often wrong from a historical bulk import,
// or simply out of date — without going through the alumnus themself.
// These fields are otherwise permanently locked once a Graduate Tracer
// Survey response is submitted (enforce_graduate_tracer_edit_lock()),
// and there is no self-service way for an alumnus to change their own
// login email at all.
//
// Only `email` needs special handling: it's also the Supabase Auth
// sign-in identifier (auth.users.email), a separate copy from
// profiles.email (see AuthContext.tsx — profile.email, not the auth
// session's own email, is what the rest of the app reads/displays).
// Updating just the profiles copy would leave the two out of sync — the
// alumnus would keep signing in with the OLD email while everything
// else in the app showed the new one — so this updates both together
// via the Admin API. Every other field here only exists in
// profiles/graduate_tracer_responses, no auth.users involvement needed.
// Fields omitted from the request body are left untouched.
// ---------------------------------------------------------------------
async function handleAdminUpdateContact(req: Request, body: any): Promise<Response> {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const profileId = String(body?.profileId || "");
  if (!profileId) return json({ error: "profileId is required." }, 400);

  const { data: existing, error: fetchErr } = await admin.from("profiles").select("id, email").eq("id", profileId).maybeSingle();
  if (fetchErr || !existing) return json({ error: "Alumnus not found." }, 404);

  const profilePatch: Record<string, unknown> = {};
  const responsePatch: Record<string, unknown> = {};

  if (typeof body.email === "string") {
    const newEmail = body.email.trim().toLowerCase();
    if (!newEmail || !newEmail.includes("@")) return json({ error: "Please enter a valid email address." }, 400);
    if (newEmail !== existing.email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(profileId, { email: newEmail, email_confirm: true });
      if (authErr) return json({ error: `Could not update sign-in email: ${authErr.message}` }, 409);
      profilePatch.email = newEmail;
      responsePatch.email = newEmail;
    }
  }
  if (typeof body.mobile_number === "string") {
    profilePatch.phone = body.mobile_number.trim() || null;
    responsePatch.mobile_number = body.mobile_number.trim() || null;
  }
  if (typeof body.current_address === "string") {
    profilePatch.address = body.current_address.trim() || null;
    responsePatch.current_address = body.current_address.trim() || null;
  }
  if (typeof body.permanent_address === "string") {
    responsePatch.permanent_address = body.permanent_address.trim() || null;
  }
  if (typeof body.social_network_id === "string") {
    responsePatch.social_network_id = body.social_network_id.trim() || null;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profErr } = await admin.from("profiles").update(profilePatch).eq("id", profileId);
    if (profErr) return json({ error: `Could not update profile: ${profErr.message}` }, 500);
  }
  if (Object.keys(responsePatch).length > 0) {
    // Bypasses enforce_graduate_tracer_edit_lock() — service_role is
    // explicitly trusted there (graduate_tracer_edit_lock_service_role_bypass.sql).
    // No-ops harmlessly if this alumnus has no submitted response yet.
    const { error: respErr } = await admin.from("graduate_tracer_responses").update(responsePatch).eq("respondent_id", profileId);
    if (respErr) console.error("[tracer-intake] admin_update_contact: graduate_tracer_responses update failed", profileId, respErr);
  }

  return json({ ok: true });
}

// ---------------------------------------------------------------------
// { action: "bulk_import", rows: [{ data, updateExistingProfileId? }] }
// — admin-only. Backs admin/BulkImportResponses.tsx: a migration path
// for historical Graduate Tracer Survey responses collected outside
// this app (e.g. a Google Forms export). Each row's `data` is already
// mapped client-side to the same shape as a normal submission payload
// (see ANSWER_COLUMNS) — this endpoint skips the roster-match step
// entirely and treats every row as admin-verified: it already has a
// real answered survey and a real email.
//
// The client pre-checks every row against existing profiles (by email,
// and by name as a softer signal) and has the admin resolve any match
// *before* this is ever called — see BulkImportResponses.tsx's preview
// step. `updateExistingProfileId` is how that resolution reaches here:
// set, it overwrites that existing person's record (updateExistingRecord)
// instead of creating a new account; omitted, this creates one the
// normal way. A row that fails is reported back as failed/skipped, not
// silently re-queued to Pending — this is a deliberate, reviewed batch,
// not a public intake.
// ---------------------------------------------------------------------
const BULK_REQUIRED_FIELDS = ["email", "first_name", "last_name"];

// Used when the admin reviewed a detected duplicate in
// admin/BulkImportResponses.tsx's preview and chose "Update existing
// record" instead of creating a new account: refreshes the matched
// profile's fields and replaces their graduate_tracer_responses row
// with this row's answers, in place. Deliberately does NOT touch
// `email` — this updates what's known about an existing person, not
// their login identity, so a duplicate matched by name (different
// email typed this time) doesn't silently move someone's login out
// from under them. Requires the service_role bypass added to
// enforce_graduate_tracer_edit_lock() (see
// graduate_tracer_edit_lock_service_role_bypass.sql) since most of
// what this overwrites is otherwise permanently locked once a response
// is submitted.
async function updateExistingRecord(profileId: string, source: Record<string, unknown>): Promise<
  | { ok: true; email: string; name: string; responseId: string | null }
  | { ok: false; error: string }
> {
  const { data: existing, error: fetchErr } = await admin.from("profiles").select("id, email").eq("id", profileId).maybeSingle();
  if (fetchErr || !existing) return { ok: false, error: "The existing account to update could not be found." };

  const firstName = String(source.first_name || "").trim();
  const lastName = String(source.last_name || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ");

  const { error: profileErr } = await admin.from("profiles").update({
    ...(name ? { name } : {}),
    department: source.college_department || null,
    program: source.program_graduated || null,
    batch_year: source.year_graduated || null,
    phone: source.mobile_number || null,
    address: source.current_address || null,
    date_of_birth: source.date_of_birth || null,
    current_company: source.company_organization || null,
    current_position: source.job_title || null,
    employment_status: mapEmploymentStatus(source.employment_status),
  }).eq("id", profileId);
  if (profileErr) return { ok: false, error: `Could not update the existing profile: ${profileErr.message}` };

  const { data: responseRow, error: responseErr } = await admin
    .from("graduate_tracer_responses")
    .upsert({
      respondent_id: profileId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ...pickAnswerColumns(source),
    }, { onConflict: "respondent_id" })
    .select("id")
    .single();
  if (responseErr) return { ok: false, error: `Could not update the existing survey response: ${responseErr.message}` };

  return { ok: true, email: existing.email, name: name || existing.email, responseId: responseRow.id };
}

async function handleBulkImport(req: Request, body: any): Promise<Response> {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  // Each entry is either a plain answer row (create a new account) or
  // { data, updateExistingProfileId } when the admin resolved a
  // detected duplicate as "update existing" instead.
  const rawRows: { data?: Record<string, unknown>; updateExistingProfileId?: string }[] =
    Array.isArray(body?.rows) ? body.rows : [];
  if (rawRows.length === 0) return json({ error: "No rows provided." }, 400);
  if (rawRows.length > 200) return json({ error: "Too many rows in one batch (max 200) — split into smaller batches." }, 400);

  const results: { email: string; name: string; status: "created" | "updated" | "skipped" | "failed"; password?: string; reason?: string }[] = [];

  for (const row of rawRows) {
    const source = row.data ?? (row as Record<string, unknown>); // tolerate a bare row for backward compatibility
    const email = String(source.email || "").trim().toLowerCase();
    const name = [String(source.first_name || "").trim(), String(source.last_name || "").trim()].filter(Boolean).join(" ") || email || "(unknown)";

    if (row.updateExistingProfileId) {
      const result = await updateExistingRecord(row.updateExistingProfileId, source);
      if (!result.ok) {
        results.push({ email, name, status: "failed", reason: result.error });
        continue;
      }
      await admin.from("alumni_tracer_intake").insert({
        status: "approved",
        linked_profile_id: row.updateExistingProfileId,
        linked_response_id: result.responseId,
        reviewed_by: guard.adminId,
        reviewed_at: new Date().toISOString(),
        notes: "Bulk-imported: updated an existing record (duplicate resolved by admin).",
        ...pickAnswerColumns(source),
      });
      results.push({ email: result.email, name: result.name, status: "updated" });
      continue;
    }

    const missing = BULK_REQUIRED_FIELDS.filter(key => !String(source[key] || "").trim());
    if (missing.length > 0) {
      results.push({ email, name, status: "skipped", reason: `Missing required field(s): ${missing.join(", ")}` });
      continue;
    }
    try {
      const result = await provisionAccount(source, { approved: true });
      if (!result.ok) {
        results.push({ email, name, status: "failed", reason: result.error });
        continue;
      }
      await admin.from("alumni_tracer_intake").insert({
        status: "approved",
        linked_profile_id: result.userId,
        linked_response_id: result.responseId,
        reviewed_by: guard.adminId,
        reviewed_at: new Date().toISOString(),
        notes: "Bulk-imported from a historical survey export.",
        ...pickAnswerColumns(source),
      });
      results.push({ email: result.email, name: result.name, status: "created", password: result.password });
    } catch (err) {
      console.error("[tracer-intake] bulk_import row threw", email, err);
      results.push({ email, name, status: "failed", reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return json({ results });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = body?.action;
  if (action === "submit") return handleSubmit(body.payload ?? {});
  if (action === "approve") return handleReview(req, body, "approve");
  if (action === "reject") return handleReview(req, body, "reject");
  if (action === "bulk_import") return handleBulkImport(req, body);
  if (action === "admin_update_contact") return handleAdminUpdateContact(req, body);
  return json({ error: "Unknown action." }, 400);
});
