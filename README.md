# SDEO (Male) Kulachi — Daily Enrollment Monitoring System

A mobile-first web application for the Sub-Divisional Education Officer (Male),
Kulachi, District Dera Ismail Khan, Khyber Pakhtunkhwa, Pakistan. Headteachers/
Incharges of government primary schools submit daily enrollment data through a
simple mobile app; the SDEO office monitors submissions in real time and every
report can be forwarded to the official SDEO WhatsApp number in one tap.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Deployment:** Vercel

## Folder Structure

```
src/
  app/
    page.tsx                    Landing page ("/")
    login/page.tsx               Headteacher login ("/login")
    dashboard/page.tsx           Headteacher dashboard ("/dashboard")
    submit-report/
      page.tsx                  Daily enrollment form ("/submit-report")
      SubmitReportForm.tsx       Client form + WhatsApp confirmation
    history/page.tsx             Submission history ("/history")
    admin/
      page.tsx                  Admin dashboard ("/admin")
      EnrollmentTrendChart.tsx   Recharts trend chart (client)
      schools/
        page.tsx                School management ("/admin/schools")
        SchoolsManager.tsx       CRUD UI (client)
      users/
        page.tsx                User management ("/admin/users")
        UsersManager.tsx         Add/assign headteachers (client)
      reports/
        page.tsx                 Reports & analytics ("/admin/reports")
        ReportsExplorer.tsx       Filter/export/print (client)
    api/admin/headteachers/route.ts  Server route: create headteacher auth account
  components/                   Reusable UI: Button, Input, Select, Card,
                                 StatCard, Alert, EmptyState, Spinner, Header,
                                 BottomNav, AdminNav, SignOutButton
  lib/
    supabase/
      client.ts                 Browser Supabase client
      server.ts                 Server Component / Route Handler client
      middleware.ts              Session refresh + route protection
      admin.ts                   Service-role client (server only)
    auth.ts                     getCurrentUser() helper (profile + school)
    types.ts                    Shared TypeScript types
    validation.ts               Zod schemas (form validation)
    whatsapp.ts                 WhatsApp message formatter + deep link
    date.ts                     Date helpers
    csv.ts                      CSV export helper
  middleware.ts                 Next.js middleware entry point
supabase/
  schema.sql                    Full database schema + RLS policies
```

## Database Schema

Three tables, defined in [`supabase/schema.sql`](./supabase/schema.sql):

**`schools`**
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| school_name | text | |
| emis_code | text | unique |
| district | text | default "Dera Ismail Khan" |
| tehsil | text | default "Kulachi" |
| circle | text | nullable |
| status | enum(`active`,`inactive`) | |
| created_at | timestamptz | |

**`profiles`** (1:1 with `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid, PK | references `auth.users(id)` |
| full_name | text | |
| mobile_number | text | |
| designation | text | default "Headteacher/Incharge" |
| school_id | uuid, FK → schools | one headteacher per school |
| role | enum(`headteacher`,`admin`) | |
| created_at | timestamptz | |

**`daily_enrollment`**
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| school_id | uuid, FK → schools | |
| user_id | uuid, FK → profiles | |
| report_date | date | default `current_date` |
| dropout / public_admission / private_admission / fresh_admission / total_enrollment | integer | `>= 0` |
| submitted_at | timestamptz | |
| updated_at | timestamptz | auto-updated via trigger |

**Unique constraint:** `(school_id, report_date)` — prevents duplicate reports
for the same school on the same day (enforced at the database level and
surfaced as a friendly message in the UI).

**Row Level Security:**
- Headteachers can `SELECT`/`INSERT`/`UPDATE` only rows for their own
  `school_id` (via `current_school_id()`), and cannot delete reports.
- Admins (role = `admin`) can read/write everything, verified via a
  `SECURITY DEFINER` `is_admin()` function to avoid recursive RLS checks.
- A trigger (`handle_new_user`) auto-creates a `profiles` row for every new
  `auth.users` signup.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (**server only**, used by `/api/admin/headteachers` to create Headteacher logins) |
| `NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER` | Official SDEO (Male) Kulachi WhatsApp number, digits only with country code, e.g. `923001234567` |

The WhatsApp number is never hardcoded in the app — it is read from this
environment variable everywhere (`src/lib/whatsapp.ts`).

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com).
3. **Run the schema** — open the Supabase SQL Editor and run the full
   contents of `supabase/schema.sql`.
4. **Create the first Admin account:**
   - In Supabase Dashboard → Authentication → Users → "Add user", create an
     account for the SDEO office (email + password).
   - In the SQL Editor, run:
     ```sql
     update public.profiles set role = 'admin', school_id = null
     where id = (select id from auth.users where email = 'sdeo.email@example.com');
     ```
5. **Configure environment variables** — copy `.env.example` to `.env.local`
   and fill in your project's values.
6. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.
7. **Log in as Admin** at `/admin` (redirects automatically after login),
   add schools under **Schools**, then add Headteacher accounts under
   **Users** and assign each to a school. Headteachers then log in at
   `/login` and use `/submit-report` daily.

## Deployment (GitHub + Vercel)

1. **Push this repository to GitHub** (already configured if you're viewing
   this from a Claude Code session — otherwise `git init`, commit, and push
   to a new GitHub repo).
2. **Import the project into Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo.
   - Framework preset: Next.js (auto-detected).
3. **Add environment variables in Vercel** (Project Settings → Environment
   Variables) — the same four variables from `.env.example`, for both
   Production and Preview environments.
4. **Deploy.** Vercel builds and hosts the app; every push to the main
   branch triggers a new deployment.
5. **Point your domain (optional):** Project Settings → Domains.

## Security Notes

- Row Level Security is enforced in Postgres — even if a client is
  compromised, a headteacher account cannot read or write another school's
  data.
- The service role key is used **only** inside `src/app/api/**` route
  handlers (server-side), never shipped to the browser.
- All numeric form fields are validated both client-side (Zod) and at the
  database level (`CHECK (... >= 0)`).

## Roadmap (architecture already in place for)

- Push notifications for daily submission reminders and pending-report
  alerts (Supabase + a notifications table can be added without touching
  existing tables).
- WhatsApp Business API integration for automated reminders (the
  `NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER` config and `src/lib/whatsapp.ts`
  formatter are already isolated for reuse).
- PDF report downloads (CSV export exists today in `/admin/reports`).
