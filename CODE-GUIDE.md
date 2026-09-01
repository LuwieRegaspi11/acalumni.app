# Code Guide — How This Project Is Organized

I reorganized your imports and added clear comment markers in the main
files so you can find things fast. **Nothing about how the app looks or
behaves was changed** — only import order, spacing, and comments.

## 1. Where's the header?

There are actually **two different headers**, because logged-out
visitors and logged-in users see different layouts:

| Header | File | What controls its color |
|---|---|---|
| Public site header (logo + nav bar on the homepage) | `src/app/components/LandingPage.tsx` — look for the `PUBLIC SITE HEADER` comment | The `PUBLIC SITE COLORS` constants (`NAVY`, `BLUE`, `LBLUE`, `RED`) near the top of the file |
| Logged-in dashboard header (top bar + sidebar, admin/alumni/faculty/rep) | `src/app/components/shared/DashboardLayout.tsx` — look for `{/* ── TOP HEADER ── */}` | It has **no color of its own** — each role passes its own color in (see #2) |

The Sign In / Sign Up page has its own separate branding panel in
`src/app/components/AuthPage.tsx`, marked with `AUTH PAGE COLORS`.

## 2. Where do I change colors?

There are three "layers" of color in this app:

1. **Global theme colors** — `src/styles/theme.css`. This is a single
   source of truth (`--ac-navy`, `--ac-blue`, `--ac-light-blue`,
   `--ac-red`, etc.) that many UI components pull from automatically.
   Change these first if you want a site-wide rebrand.
2. **Per-page colors** — some pages (Landing, Auth) define their own
   local color constants near the top of the file instead of using the
   CSS variables. I marked these with comments so you can find them.
3. **Per-role dashboard accent color** — each of the four dashboards
   (`AdminDashboard.tsx`, `AlumniDashboard.tsx`, `UserDashboard.tsx`,
   `RepresentativeDashboard.tsx`) passes its own `accentColor` /
   `accentGradient` into `<DashboardLayout>` — that's why Admin is
   blue, Faculty is red/orange, etc. I marked each with a comment
   right where it's set.

## 3. What do all these imports mean?

I grouped every big file's imports into the same labeled buckets, so
scanning any file's top few lines tells you what it depends on:

- **React & routing** — `react`, `react-router`. Core framework, always there.
- **App-wide context/state** — things like `useAuth`, `useDarkMode`,
  `useNotifications`, `useDonations`, `useEvents`. These are global
  state shared across the whole app (see `#4` below).
- **Icons** — everything from `lucide-react`. Just icon components.
- **Third-party UI libraries** — `@mui/material` (Material UI — tables,
  dialogs, form fields) and `recharts` (charts). Pre-built components
  you didn't write, used for convenience.
- **Shared components** — things in `components/shared/`, reused by
  more than one role (e.g. `JobBoard`, `EventCalendar`, `ProfilePage`).
- **Page-specific sub-components** — e.g. everything in
  `components/admin/`, `components/alumni/`, `components/faculty/`,
  `components/representative/`. One file per sidebar item.
- **Local image assets** — files imported from `src/imports/`.

## 4. The `components/ui/` folder

I deliberately **did not touch** `src/app/components/ui/` — those ~50
files (`button.tsx`, `dialog.tsx`, `input.tsx`, etc.) are a standard
component library (shadcn/ui), not code you wrote by hand. They're
already consistent and low-level; you generally shouldn't need to edit
them to change colors or layout — that happens in `theme.css` or in
the page files that *use* these components.

## 5. Where things live, at a glance

```
src/
  app/
    App.tsx                     ← routing map (URL → page)
    components/
      LandingPage.tsx            ← public homepage (own header + colors)
      AuthPage.tsx                ← sign in / sign up + alumni registration form (own header + colors)
      AdminDashboard.tsx          ← admin role: nav items + accent color
      AlumniDashboard.tsx         ← alumni role: nav items + accent color
      UserDashboard.tsx           ← faculty role: nav items + accent color
      RepresentativeDashboard.tsx ← rep role: nav items + accent color
      shared/
        DashboardLayout.tsx       ← THE logged-in header + sidebar (shared)
        *Context.tsx              ← global state (auth, dark mode, etc.)
      admin/ alumni/ faculty/ representative/  ← one file per sidebar page
      ui/                         ← shadcn UI library — don't need to edit
  styles/
    theme.css                     ← global brand colors (edit here first)
```

## Want more?

I focused this pass on the files that control layout, header, and
color, since that's what you said you needed. If you want me to also
clean up the individual admin/alumni/faculty sub-pages (the files
inside `components/admin/`, `components/alumni/`, etc.) the same way,
just say which ones and I'll do those next.
