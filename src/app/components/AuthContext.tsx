import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface User {
 id: string;
 name: string;
 email: string;
 role: 'admin' | 'alumni' | 'faculty' | 'representative';
 registrationStatus?: 'pending' | 'approved' | 'rejected';
 department?: string;
 batchYear?: number;
 program?: string;
 profileImage?: string;
 assignedBatchYear?: number;
 assignedDepartment?: string;
 assignedProgram?: string;
 phone?: string;
 address?: string;
 studentId?: string;
 graduationDate?: string;
 currentCompany?: string;
 currentPosition?: string;
 username?: string;   // admin accounts
 position?: string;   // faculty accounts (job title, distinct from alumni's currentPosition)
}

// Fields on `profiles` that a signed-in user is allowed to update about
// themselves (name/role/registration_status etc. are intentionally excluded).
export interface ProfileUpdate {
 name?: string;
 phone?: string;
 address?: string;
 profileImage?: string;
 department?: string;
 batchYear?: number;
 program?: string;
 currentCompany?: string;
 currentPosition?: string;
 username?: string;
 position?: string;
}

export interface RegistrationData {
 firstName: string;
 lastName: string;
 email: string;
 password: string;
 address: string;
 department: string;
 program: string;
 batchYear?: number;
 profileImage?: string;
 studentId?: string;
 // Valid-ID photo, collected in place of a phone number at signup (see
 // id_document_upload.sql / handle_new_user()) — base64 data URL, same
 // convention as profileImage, copied into profiles.id_document_url.
 idType?: string;
 idDocument?: string;
}

export type LoginStatus = 'success' | 'invalid' | 'pending' | 'rejected' | 'unconfirmed' | 'error' | 'no_profile';
export interface LoginResult {
 status: LoginStatus;
 // Only set for an 'invalid' result that ISN'T Supabase's standard "wrong
 // password" response — surfaces what actually went wrong (rate limiting,
 // a misconfigured project, etc.) instead of silently collapsing every
 // other failure into a misleading "Invalid email or password."
 detail?: string;
}

interface AuthContextType {
 user: User | null;
 loading: boolean;
 login: (email: string, password: string) => Promise<LoginResult>;
 logout: () => void;
 register: (data: RegistrationData) => Promise<{ ok: boolean; error?: string }>;
 updateProfile: (patch: ProfileUpdate) => Promise<boolean>;
 refreshProfile: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileToUser(profile: any): User {
 return {
   id: profile.id,
   name: profile.name,
   email: profile.email,
   role: profile.role,
   registrationStatus: profile.registration_status ?? undefined,
   department: profile.department ?? undefined,
   batchYear: profile.batch_year ?? undefined,
   program: profile.program ?? undefined,
   profileImage: profile.profile_image ?? undefined,
   assignedBatchYear: profile.assigned_batch_year ?? undefined,
   assignedDepartment: profile.assigned_department ?? undefined,
   assignedProgram: profile.assigned_program ?? undefined,
   phone: profile.phone ?? undefined,
   address: profile.address ?? undefined,
   studentId: profile.student_id ?? undefined,
   graduationDate: profile.graduation_date ?? undefined,
   currentCompany: profile.current_company ?? undefined,
   currentPosition: profile.current_position ?? undefined,
   username: profile.username ?? undefined,
   position: profile.position ?? undefined,
 };
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
 return Promise.race([
   promise,
   new Promise<T>((_, reject) =>
     setTimeout(() => reject(new Error(`[timeout] ${label} took longer than ${ms}ms`)), ms)
   ),
 ]);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retries once on a transient failure (network hiccup, a client-side
// timeout that fired before a perfectly healthy response made it back).
// Supabase's own edge logs routinely show signInWithPassword answering in
// well under a second, so a client-visible timeout here means the
// request/response was lost between this browser and Supabase, not that
// Supabase was slow — retrying once is usually enough to get past it
// instead of failing the whole sign-in on one bad round trip.
async function signInWithRetry(email: string, password: string, attempts = 2) {
 let lastErr: unknown;
 for (let attempt = 1; attempt <= attempts; attempt++) {
   try {
     return await withTimeout(
       supabase.auth.signInWithPassword({ email, password }),
       10000,
       'signInWithPassword'
     );
   } catch (err) {
     lastErr = err;
     console.error('[auth] signInWithPassword: threw', { attempt, err });
     if (attempt < attempts) await sleep(500 * attempt);
   }
 }
 throw lastErr;
}

// Retries a couple of times on transient failures (network hiccups, a
// flaky 5xx from the API gateway) before giving up. Without this, a
// single bad response to this one request — right after a perfectly
// valid signInWithPassword — silently failed the whole sign-in and got
// reported to the user as "Invalid email or password", which looked
// like the app just wasn't responding to a pending account's login.
//
// `signal` is wired to `.abortSignal()` so a caller that's given up on
// this call (see `beginAttempt` below) actually cancels the in-flight
// request instead of merely losing interest in it. Without this, a slow
// response kept running in the background after its own 10s timeout
// fired, and could land many seconds later against whatever session was
// then current — e.g. after the person retried and signed in as someone
// else — producing a confusing 406 (RLS correctly refusing a stale
// request under the new session) that looked like the account itself
// was broken.
// Returns the profile plus, when it fails, *why* — the caller-facing
// "couldn't reach the server" message used to swallow this completely,
// which made a genuine outage indistinguishable from an RLS/config
// mistake or a plain network block, and left nothing to go on when
// debugging a report of it. `errorDetail` carries the last real
// error/timeout message across all retries so it can be surfaced.
async function fetchProfile(
 userId: string, signal: AbortSignal, attempts = 3
): Promise<{ profile: User | null; errorDetail?: string; missingProfile?: boolean }> {
 let lastErrorDetail: string | undefined;
 let lastMissingProfile = false;
 for (let attempt = 1; attempt <= attempts; attempt++) {
   if (signal.aborted) return { profile: null, errorDetail: lastErrorDetail, missingProfile: lastMissingProfile };
   try {
     const { data, error } = await withTimeout(
       supabase.from('profiles').select('*').eq('id', userId).abortSignal(signal).single(),
       10000,
       'fetchProfile query'
     );
     if (!error && data) return { profile: mapProfileToUser(data) };
     if (error) {
       lastErrorDetail = error.message || (error as { code?: string }).code;
       // PostgREST's .single() reports "no matching row" and "more than
       // one matching row" with the same generic code/message — only
       // `details` actually says which. A genuinely missing `profiles`
       // row (see handle_new_user()'s insert silently failing for a
       // signup, e.g. avropelos.student@... on 2026-08-19, which left an
       // auth account that could never sign in) is a permanent data
       // problem, not a network hiccup — reporting it as "couldn't reach
       // the server" hid a broken account behind a misleading message
       // instead of pointing at what was actually wrong.
       const details = (error as { details?: string }).details || '';
       lastMissingProfile = /0 rows/i.test(details);
     }
     if (attempt < attempts) await sleep(500 * attempt);
   } catch (err) {
     if (signal.aborted) return { profile: null, errorDetail: lastErrorDetail, missingProfile: lastMissingProfile };
     console.error('[auth] fetchProfile: threw', { attempt, err });
     lastErrorDetail = err instanceof Error ? err.message : String(err);
     if (attempt < attempts) await sleep(500 * attempt);
   }
 }
 return { profile: null, errorDetail: lastErrorDetail, missingProfile: lastMissingProfile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
 const [user, setUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);

 // Mirrors `user` so the async auth-state handler below can check "do we
 // already have this person loaded" without depending on (and re-running
 // for) every `user` change.
 const userRef = React.useRef<User | null>(null);
 useEffect(() => { userRef.current = user; }, [user]);

 // Guards against two profile-loading attempts racing each other — e.g.
 // someone retries a slow sign-in as a different account before the
 // first attempt's fetchProfile has given up, or a TOKEN_REFRESHED fires
 // mid-login. Only the most recent attempt is allowed to touch `user`;
 // starting a new one aborts whichever was previously in flight so it
 // can't come back later and stomp newer state (or keep hitting Supabase
 // in the background after nobody's waiting on it anymore).
 const activeAttemptRef = React.useRef<AbortController | null>(null);
 const beginAttempt = () => {
   activeAttemptRef.current?.abort();
   const controller = new AbortController();
   activeAttemptRef.current = controller;
   return controller;
 };

 // Set for the duration of every login() call below. A successful
 // supabase.auth.signInWithPassword() also fires the onAuthStateChange
 // listener's own 'SIGNED_IN' handling (see syncSession) for that exact
 // same sign-in — without this flag, that listener started its own
 // competing fetchProfile via beginAttempt(), which aborted (or was
 // aborted by) login()'s own fetch. One single, deliberate sign-in would
 // then race against itself, and whichever attempt lost was misreported
 // as "Superseded by a newer sign-in attempt" even though nothing newer
 // had actually started. login() sets this before signing in and clears
 // it once it's done handling the profile itself, so the listener knows
 // to stand down for that window (see the SIGNED_IN check in syncSession).
 const loginInFlightRef = React.useRef(false);

 useEffect(() => {
   let active = true;

   // Shared by the initial getSession() check and every subsequent
   // onAuthStateChange firing (SIGNED_IN, TOKEN_REFRESHED, etc).
   //
   // Supabase silently rotates the access token every few minutes for as
   // long as the app is open — tab focused or not — which fires
   // TOKEN_REFRESHED here. That event doesn't mean anything about the
   // profile changed, so there's no need to re-fetch it if we already
   // have this same user loaded. This also avoids the bug that was
   // logging people out: a slow/failed profile fetch (network hiccup,
   // a background tab's throttled request hitting the 10s timeout) was
   // being treated identically to "no session" and forcing a sign-out,
   // even though the Supabase session itself was still perfectly valid.
   const syncSession = async (event: string, session: { user: { id: string } } | null) => {
     if (session?.user) {
       if (event === 'TOKEN_REFRESHED' && userRef.current?.id === session.user.id) {
         return;
       }
       // login() is already fetching this same session's profile itself
       // (see loginInFlightRef above) and will set `user` when that
       // resolves — starting a second, competing fetch here would only
       // race it over the shared abort guard below.
       if (event === 'SIGNED_IN' && loginInFlightRef.current) {
         return;
       }
       const controller = beginAttempt();
       const { profile, errorDetail } = await fetchProfile(session.user.id, controller.signal);
       if (controller.signal.aborted) return; // superseded by a newer attempt — leave state to it
       // Rejected accounts are blocked entirely. Pending accounts DO get
       // signed in — they just get a restricted view (see AlumniDashboard),
       // so alumni can check on/act on their own status instead of being
       // stuck outside the app.
       if (profile && profile.registrationStatus === 'rejected') {
         await supabase.auth.signOut();
         if (active) setUser(null);
       } else if (profile) {
         if (active) setUser(profile);
       } else if (userRef.current?.id !== session.user.id) {
         // No profile came back and it's not just a hiccup on a session
         // we already trust (different/no user loaded) — treat as
         // genuinely signed out.
         if (active) setUser(null);
       } else {
         console.warn('[auth] fetchProfile failed on', event, '— keeping existing session instead of logging out. Reason:', errorDetail);
       }
     } else {
       activeAttemptRef.current?.abort();
       if (active) setUser(null);
     }
   };

   supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      await syncSession('INITIAL_SESSION', session);
      if (active) setLoading(false);
    }).catch(err => {
      console.error('[auth] getSession threw', err);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      await syncSession(event, session);
    });
   return () => {
     active = false;
     listener.subscription.unsubscribe();
   };
 }, []);

 const login = async (email: string, password: string): Promise<LoginResult> => {
   loginInFlightRef.current = true;
   try {
     const { data, error } = await signInWithRetry(email, password);
     if (error) {
       // Supabase blocks sign-in entirely for an account whose email isn't
       // confirmed yet — it never gets far enough to check our own
       // registration_status (pending/rejected). That's a different
       // situation from a genuinely wrong email/password, so surface it
       // separately instead of lumping it in with 'invalid': the caller
       // can look the account up by email (see AuthPage's checkStatus)
       // and tell the person their real status instead of "wrong password".
       const code = (error as { code?: string }).code;
       const message = error.message || '';
       if (code === 'email_not_confirmed' || /email.*not.*confirmed/i.test(message)) {
         return { status: 'unconfirmed' };
       }
       // Supabase's own "wrong password" response has a recognizable
       // code/message. Anything else landing here (rate limiting, a
       // misconfigured project, a banned user, etc.) is unusual enough
       // that flattening it into "Invalid email or password" would hide
       // the real cause — so only suppress the detail for the genuine
       // wrong-credentials case.
       const isWrongCredentials = code === 'invalid_credentials' || /invalid login credentials/i.test(message);
       return { status: 'invalid', detail: isWrongCredentials ? undefined : (message || code || 'Unknown error') };
     }
     if (!data.user) return { status: 'invalid', detail: 'Sign-in request returned no account.' };

     const controller = beginAttempt();
     const { profile, errorDetail, missingProfile } = await fetchProfile(data.user.id, controller.signal);
    if (controller.signal.aborted) {
      // A newer sign-in (or auth-state event) started before this one
      // finished — e.g. the person retried as a different account after
      // this one seemed stuck. Don't sign anything out or touch `user`:
      // that would tear down whatever the newer attempt just set up.
      return { status: 'error', detail: 'Superseded by a newer sign-in attempt.' };
    }
    if (!profile) {
      await supabase.auth.signOut();
      setUser(null);
      // A missing `profiles` row is a permanent data problem (the
      // account's registration never finished being recorded — see
      // handle_new_user()), not a flaky response — surface it as its
      // own status instead of the generic connectivity message below,
      // which used to make a genuinely broken account look like a
      // network hiccup instead of something support needs to fix.
      if (missingProfile) return { status: 'no_profile' };
      // The credentials were correct (signInWithPassword above already
      // succeeded) — this is a failure to load the profile row itself
      // (a flaky response from the API after retrying, etc), which is a
      // very different situation from a wrong password. Reporting this
      // as 'invalid' used to make a correct pending-account sign-in look
      // like it just silently failed/did nothing. `errorDetail` carries
      // the actual last error (RLS/network/timeout) instead of leaving
      // the caller to show a generic, undiagnosable message.
      return { status: 'error', detail: errorDetail };
    }

    // Rejected accounts still can't get in at all. Pending accounts DO
    // sign in now — they just land on a restricted view of the app (see
    // AlumniDashboard) instead of being bounced back out.
    if (profile.registrationStatus === 'rejected') {
      await supabase.auth.signOut();
      setUser(null);
      return { status: 'rejected' };
    }

    setUser(profile);
    return { status: profile.registrationStatus === 'pending' ? 'pending' : 'success' };

   } catch (err) {
     console.error('[auth] login: threw', err);
     const message = err instanceof Error ? err.message : '';
     return { status: 'invalid', detail: message || undefined };
   } finally {
     loginInFlightRef.current = false;
   }
 };

 const logout = () => {
   activeAttemptRef.current?.abort();
   supabase.auth.signOut();
   setUser(null);
 };

 // Re-fetches the signed-in user's own profile row — used by the Pending
 // Approval page's "Check Status" button so someone waiting on admin
 // approval can find out they've been approved/rejected without having
 // to sign out and back in.
 const refreshProfile = async (): Promise<{ ok: boolean; error?: string }> => {
   if (!user) return { ok: false, error: 'Not signed in.' };
   const controller = beginAttempt();
   const { profile, errorDetail } = await fetchProfile(user.id, controller.signal);
   if (controller.signal.aborted) return { ok: false, error: 'Could not check your status right now. Please try again.' };
   if (!profile) {
     console.error('[auth] refreshProfile: failed', errorDetail);
     return { ok: false, error: 'Could not check your status right now. Please try again.' };
   }

   if (profile.registrationStatus === 'rejected') {
     await supabase.auth.signOut();
     setUser(null);
     return { ok: true };
   }

   setUser(profile);
   return { ok: true };
 };

 const updateProfile = async (patch: ProfileUpdate): Promise<boolean> => {
   if (!user) return false;
   const dbPatch: Record<string, unknown> = {};
   if (patch.name !== undefined) dbPatch.name = patch.name;
   if (patch.phone !== undefined) dbPatch.phone = patch.phone;
   if (patch.address !== undefined) dbPatch.address = patch.address;
   if (patch.profileImage !== undefined) dbPatch.profile_image = patch.profileImage;
   if (patch.department !== undefined) dbPatch.department = patch.department;
   if (patch.batchYear !== undefined) dbPatch.batch_year = patch.batchYear;
   if (patch.program !== undefined) dbPatch.program = patch.program;
   if (patch.currentCompany !== undefined) dbPatch.current_company = patch.currentCompany;
   if (patch.currentPosition !== undefined) dbPatch.current_position = patch.currentPosition;
   if (patch.username !== undefined) dbPatch.username = patch.username;
   if (patch.position !== undefined) dbPatch.position = patch.position;

   const { error } = await supabase.from('profiles').update(dbPatch).eq('id', user.id);
   if (error) {
     console.error('[auth] updateProfile: failed', error);
     return false;
   }
   setUser({ ...user, ...patch } as User);
   return true;
 };

 const register = async (data: RegistrationData): Promise<{ ok: boolean; error?: string }> => {
   try {
     const { data: signUpData, error: signUpError } = await withTimeout(
       supabase.auth.signUp({
         email: data.email,
         password: data.password,
         options: {
           data: {
             name: `${data.firstName} ${data.lastName}`,
             department: data.department,
             batch_year: data.batchYear || null,
             program: data.program,
             address: data.address,
             student_id: data.studentId || null,
             id_type: data.idType || null,
             id_document: data.idDocument || null,
             profile_image:
               data.profileImage ||
               `https://ui-avatars.com/api/?name=${data.firstName}+${data.lastName}&background=0ea5e9&color=fff`,
           },
         },
       }),
       10000,
       'signUp'
     );

     if (signUpError) {
       console.error('[auth] register: signUp error', signUpError);
       // Surface the actual reason instead of guessing — this used to be
       // hardcoded to "email already registered" for every failure, which
       // was flat wrong for e.g. oversized photo uploads (413s) or
       // network/timeout errors.
       const status = (signUpError as { status?: number }).status;
       const code = (signUpError as { code?: string }).code;
       const message = signUpError.message || '';
       if (status === 413 || code === 'request_entity_too_large' || /too large/i.test(message)) {
         return { ok: false, error: 'Your uploaded photos are too large. Please try smaller images and submit again.' };
       }
       if (code === 'user_already_exists' || /already registered|already exists/i.test(message)) {
         return { ok: false, error: 'This email is already registered. Please use a different email or sign in.' };
       }
       return { ok: false, error: message || 'Registration failed. Please try again.' };
     }
     if (!signUpData.user) {
       return { ok: false, error: 'Registration failed. Please try again.' };
     }
     return { ok: true };
   } catch (err) {
     console.error('[auth] register: threw', err);
     const message = err instanceof Error ? err.message : '';
     return { ok: false, error: message || 'Registration failed. Please try again.' };
   }
 };

 return (
   <AuthContext.Provider value={{ user, loading, login, logout, register, updateProfile, refreshProfile }}>
     {children}
   </AuthContext.Provider>
 );
}

export function useAuth() {
 const context = useContext(AuthContext);
 if (context === undefined) {
   throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
}