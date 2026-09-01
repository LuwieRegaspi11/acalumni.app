# Alumni Tracer and Donation System

A web application for **Asian College – Dumaguete Campus** that manages alumni records,
tracer surveys, donations, events, job postings, and batch representative verification.
Built as a single-page React app with role-based dashboards for Admins, Alumni, Faculty,
and Batch Representatives.

Progressively cleaned up, made responsive, and given working dark mode support.

---

## Running the code

```bash
npm i
npm run dev
```

This starts the Vite development server (default: `http://localhost:5173`).

Other available scripts:

```bash
npm run build   # production build (outputs to dist/)
```

**Requirements:** Node.js 18+ and npm (or pnpm, since a `pnpm-workspace.yaml` is included).

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Supabase (Postgres + Auth + Storage + Realtime), accessed via `@supabase/supabase-js` |
| Framework | React 18 + TypeScript |
| Build tool | Vite 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 (utility classes + a custom dark-mode override stylesheet) |
| UI primitives | shadcn/ui (Radix UI) components in `src/app/components/ui/` |
| Additional components | MUI (Material UI) — used in several data-heavy admin pages (tables, selects, chips) |
| Charts | Recharts |
| Icons | lucide-react |
| Forms | react-hook-form |

---

## ✅ Current state: real Supabase backend, fully wired

Every screen — alumni records, donations, events, announcements, job postings, tracer
surveys, audit logs, batch representative assignment, system settings, and accounts —
is backed by a real Supabase Postgres database (RLS-secured tables, SECURITY DEFINER
helper functions, and a private/public storage bucket pair). Nothing is hardcoded
in-memory anymore; refreshing the page or logging in from another device shows the
same data. See `DATABASE-SETUP.md` for the schema this project runs on.

### Accounts

There's no generic demo-password table anymore — the four seed accounts (one per
role: admin, alumni, faculty, representative) were carried over from an earlier
Supabase project the app owner already has credentials for. New alumni can
self-register through the `/register` page; new accounts start `pending` until an
admin approves them in **Pending Registrations**.

---

## Project structure

```
src/
├── main.tsx                     # App entry point
├── styles/
│   ├── tailwind.css             # Tailwind entry + custom-variant setup for class-based dark mode
│   └── theme.css                # Global CSS overrides that drive dark mode (html.dark ...)
├── imports/                     # Static image assets (logo, landing page photos)
└── app/
    ├── App.tsx                  # Router setup, role-protected routes, MUI theme bridge
    └── components/
        ├── LandingPage.tsx      # Public marketing/landing page
        ├── AuthPage.tsx         # Combined sign-in / sign-up page (used at /login and /register)
        ├── AuthContext.tsx      # Mock auth provider (login/register/logout, mock user list)
        ├── AdminDashboard.tsx   # Admin shell + routes (see below)
        ├── AlumniDashboard.tsx  # Alumni shell + routes
        ├── UserDashboard.tsx    # Faculty shell + routes
        ├── RepresentativeDashboard.tsx  # Batch Representative shell + routes
        ├── admin/                # Admin-only feature pages
        ├── alumni/                # Alumni-only feature pages
        ├── faculty/               # Faculty-only feature pages
        ├── representative/        # Batch Representative feature pages
        ├── shared/                # Cross-role components (layout, dark mode, notifications,
        │                          # events/donations/job-board contexts, profile page, etc.)
        └── ui/                    # shadcn/ui primitive components (buttons, dialogs, tables, ...)
```

### Roles and routes

The app uses role-based protected routing (`ProtectedRoute` in `App.tsx`). After login,
each role lands on its own dashboard shell with nested routes:

- **`/admin/*`** — Admin: overview, pending registrations, batch representatives,
  population analytics, alumni database, donation management, event management,
  announcements, job board, department management, user accounts, reports, audit logs,
  system settings.
- **`/alumni/*`** — Alumni: profile, tracer survey, donations, events, job board.
- **`/user/*`** — Faculty: tracer survey view, dashboard home.
- **`/representative/*`** — Batch Representative: verification tools for their assigned
  batch/department/program.
- **`/login`, `/register`** — Public auth pages.
- **`/`** — Public landing page.

> **Note:** Two older standalone pages, `LoginPage.tsx` and `RegistrationPage.tsx`, were
> superseded by the combined `AuthPage.tsx` (which handles both sign-in and sign-up with
> tab switching) and have since been deleted, along with the orphaned
> `admin/AlumniDatabase.tsx` and `admin/DonationMonitoring.tsx`.

---

## Key features already implemented

- **Dark mode** — toggled from the dashboard header, persisted in `localStorage`,
  applied via a `.dark` class on `<html>`. Driven by a combination of Tailwind's
  `dark:` variant (for shadcn/ui primitives) and a global CSS override stylesheet
  (`src/styles/theme.css`) for everything else, plus an MUI theme bridge
  (`MuiThemeBridge` in `App.tsx`) so MUI components (tables, selects, chips, etc.)
  switch palettes too. Recharts-based analytics charts also adapt their axis/grid/
  tooltip colors.
- **Responsive layout** — dashboard shells collapse to a mobile drawer navigation,
  stat/data grids reflow from multi-column to single-column on narrow screens, and
  the sign-in/sign-up page switches from a desktop split-panel layout to a
  single-column mobile view with tab switching.
- **Role-based access control** — each dashboard route is guarded by role; users are
  redirected to `/unauthorized` if they try to access a route outside their role.

---

## Known limitations / next steps

1. **PDF/CSV export buttons** in Reports and Tracer Surveys ("Generate PDF", "Export",
   "Generate Letters") are UI stubs with no handler — generating real files wasn't
   part of the backend work and would need a PDF/CSV library wired in separately.
2. **Landing page images are local, but most other imagery (avatars, etc.) falls back
   to remote** `ui-avatars.com`-generated placeholders when a user hasn't uploaded a
   real photo yet (profile photo upload itself is wired to Supabase Storage).
3. **No automated tests** currently exist in this project.

---

## Attribution

See `ATTRIBUTIONS.md` for third-party library and asset licensing notes.
