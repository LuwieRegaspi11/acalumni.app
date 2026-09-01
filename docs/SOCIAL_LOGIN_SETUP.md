# Social Login Setup (Google / Facebook / LinkedIn)

The app code for social sign-in is already fully wired — see `AuthPage.tsx`
(`SocialIcons`), `AuthCallback.tsx`, and `CompleteProfilePage.tsx`. The buttons
on `/login` and `/register` call real `supabase.auth.signInWithOAuth()`; there
is nothing left to build in the frontend.

**All that's left is enabling each provider in the Supabase Dashboard**, which
requires registering an OAuth app with Google/Meta/LinkedIn (their consoles,
not this repo) and pasting the resulting Client ID/Secret into Supabase.

This project's Supabase project is **`amzteigyblhrbycussys`** ("Alumni Tracer
Testing" — confirmed from `VITE_SUPABASE_URL` in `.env`). Every redirect URI
below is specific to that project.

---

## The one URL every provider needs

Supabase's own OAuth callback (goes in *their* consoles, not this app):

```
https://amzteigyblhrbycussys.supabase.co/auth/v1/callback
```

## 1. Google

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services
   → Credentials** → **Create Credentials → OAuth client ID** → type **Web
   application**.
2. **Authorized redirect URIs** → add the Supabase callback URL above.
3. **Authorized JavaScript origins** → add `http://localhost:5173` (dev) and
   your production domain once deployed.
4. If prompted, configure the **OAuth consent screen** first (app name, support
   email, scopes: `email`, `profile`, `openid` are enough).
5. Copy the **Client ID** and **Client Secret**.
6. Supabase Dashboard → **Authentication → Providers → Google** → toggle on,
   paste Client ID/Secret → **Save**.

## 2. Facebook

1. [Facebook for Developers](https://developers.facebook.com/) → **My Apps →
   Create App** → choose **"Authenticate and request data from users with
   Facebook Login"** (Consumer type).
2. Add the **Facebook Login** product.
3. Facebook Login → **Settings** → **Valid OAuth Redirect URIs** → add the
   Supabase callback URL above.
4. **App Settings → Basic** → copy the **App ID** and **App Secret**.
5. Supabase Dashboard → **Authentication → Providers → Facebook** → toggle on,
   paste App ID/Secret → **Save**.
6. Note: while the app is in **Development mode**, only accounts added as
   Admins/Developers/Testers on the Facebook app can sign in. Submit for **App
   Review** (or switch to Live) once ready for real alumni to use it — basic
   `email`/`public_profile` login typically doesn't require review, but the app
   still needs to be switched to Live mode.

## 3. LinkedIn

1. [LinkedIn Developers](https://www.linkedin.com/developers/apps) → **Create
   app**.
2. Under **Products**, add **"Sign In with LinkedIn using OpenID Connect"**.
3. **Auth** tab → **Authorized redirect URLs for your app** → add the Supabase
   callback URL above.
4. Copy the **Client ID** and **Client Secret** (Auth tab).
5. Supabase Dashboard → **Authentication → Providers → LinkedIn (OIDC)** →
   toggle on, paste Client ID/Secret → **Save**.

   (The app's own code already targets `linkedin_oidc` as the provider name —
   this matches Supabase's current LinkedIn integration, not the older
   deprecated `linkedin` provider.)

## 4. Tell Supabase which URLs this app is allowed to redirect back to

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL (or `http://localhost:5173` while testing
  locally, then update it once deployed).
- **Redirect URLs**: add every origin's callback explicitly, e.g.
  - `http://localhost:5173/auth/callback`
  - `https://<your-production-domain>/auth/callback`

Without an exact match here, `signInWithOAuth`'s `redirectTo` gets silently
ignored/rejected and the user bounces back to an unintended URL after login.

---

## Testing

1. Enable one provider at a time and test its button on `/login` before moving
   to the next — makes it obvious which provider's config is broken if
   something fails.
2. A brand-new social sign-in lands on `/complete-profile` (department/program/
   batch year are never supplied by these providers) — that's expected, not a
   bug.
3. After completing their profile, the account is `role: 'alumni'`,
   `registration_status: 'pending'` — same as an email/password signup —
   so it still needs admin approval in **Pending Registrations** before full
   dashboard access.
