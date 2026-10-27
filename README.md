# JobFlow

JobFlow is a privacy-focused job application tracker for people who want to manage interviews, follow-ups, and career momentum without depending on spreadsheets or scattered notes. The project combines a lightweight static frontend with Supabase for authentication, data storage, and secure access control.

## Why this project exists

The app was designed around a common but frustrating problem: job seekers often track applications in spreadsheets, emails, and chat threads, which makes it hard to see status changes, interviews, follow-ups, and contact history in one place. JobFlow centralizes that information into one private workspace with clear stages, reminders, and analytics derived from actual user activity rather than guesswork.

This implementation is intentionally simple and direct: a static web app with no custom backend framework, backed by Supabase, so it remains lightweight, fast to deploy, and easy to maintain while still offering secure user data isolation.

## Problem and solution

Problem:

- Applications are spread across multiple tools and channels.
- It is difficult to know which roles are active, awaiting follow-up, or rejected.
- Interview and reminder tracking often gets lost outside a single source of truth.

Solution:

- A single dashboard for applications, interviews, contacts, and reminders.
- A status-based workflow from saved to offer or rejection.
- Analytics based on the user’s own data to understand response, interview, and offer rates.
- Secure personal storage using Supabase Auth and Row Level Security.

## Features

- Email/password authentication with Supabase Auth
- Application tracking with search, filters, sorting, pagination, table view, and Kanban view
- Interview scheduling and detail tracking
- Contacts and recruiter relationship tracking
- Notes, reminders, and timeline-style application activity
- Dashboard metrics and funnel analytics generated from real entries
- CSV import/export workflow for job data
- Responsive layout for desktop and mobile browsing
- Project-level security model using Supabase RLS for per-user data access

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript, ES modules
- Backend/auth: Supabase Auth, PostgREST, PostgreSQL, Row Level Security
- Optional server-side work: Supabase Edge Functions in Deno
- Data migrations: SQL migration files under the Supabase folder

## Project structure

```text
.
├── index.html
├── config.example.js
├── .gitignore
├── README.md
├── LICENSE
├── css/
│   ├── style.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── analytics.js
│   ├── applications.js
│   ├── auth.js
│   ├── config.js
│   ├── contacts.js
│   ├── dashboard.js
│   ├── interviews.js
│   ├── settings.js
│   ├── supabase.js
│   ├── ui.js
│   ├── utils.js
│   └── validation.js
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── assets/
│   ├── icons/
│   └── images/
└── .env.example
```

## Installation and setup

### Prerequisites

- A Supabase project
- A browser to run the frontend
- Optional: Supabase CLI if you want to deploy the edge functions

### 1) Create the Supabase database

Open the Supabase SQL editor and run the migration files in order:

1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/migrations/003_indexes.sql
4. supabase/migrations/004_triggers.sql

### 2) Configure authentication

In the Supabase dashboard:

- Enable Email login under Authentication → Providers
- Set the application URL and redirect URL for your local or deployed instance
- Optional: keep the default email templates

### 3) Add your Supabase keys

Copy the example file and fill in your values:

```bash
cp config.example.js js/config.js
```

Then set:

```js
export const SUPABASE_URL = "https://your-project.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Do not add the service-role key to the frontend. It must remain server-side only.

### 4) Run the app

From the project root:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Environment variables

This project uses the browser-safe values below from the Supabase API settings:

- SUPABASE_URL: project URL from Supabase
- SUPABASE_ANON_KEY: public anon key
- APP_NAME: application display name
- DEFAULT_PAGE_SIZE: default paginator size

The service-role key is intentionally not used in the browser and must only live in the Supabase Edge Function environment.

## Usage

1. Sign up or sign in with your email address.
2. Add a job application from the Applications view.
3. Update the application stage as you move through the hiring process.
4. Add interviews, notes, contacts, and reminders when relevant.
5. Review the Dashboard and Analytics pages to understand your pipeline and follow-ups.
6. Export or import data from CSV when needed.

## Database and security model

The database layer uses per-user ownership patterns. Each application, interview, note, reminder, and related record is linked to the authenticated user and protected by Row Level Security policies. This means users only see their own data, even when using the same Supabase project.

## Current verification status

The app does not ship with a Node-based test suite or package.json build pipeline. The project is intentionally static and is validated through:

- JavaScript syntax checks for the app modules
- Static serving in a browser for smoke testing
- Manual review of the auth flow, data schema, and UI flows against the actual code

## Contributing

Contributions are welcome if they improve correctness, usability, or maintainability. For changes, please:

1. Keep the static app architecture intact unless there is a clear, necessary reason to change it.
2. Validate with the relevant local smoke checks before submitting changes.
3. Avoid committing secrets, real credentials, or generated artifacts.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Notes

- The project is designed to work with a real Supabase project, not a local-only database.
- Some server-side features such as account deletion are optional and available only when the corresponding Edge Function is deployed securely.
- The app deliberately keeps the implementation lightweight and maintainable rather than introducing a larger framework for a simple job-tracking workflow.

- **Public key**: the anon/public key is safe in the browser because it has no power beyond what RLS allows.
- **Service role**: exists only as a secret inside the `delete-account` Edge Function's environment; never in frontend code or Git.
- **Input validation**: client-side validation (`js/validation.js`) for UX, backed by database `check` constraints (e.g. `status in (...)`) as the real guarantee.

## Import / Export

- **Import**: Applications page → "Import CSV". Expects columns `company_name, job_title, location, employment_type, work_mode, status, priority, source, applied_at, job_url` (only `company_name` and `job_title` are required). Shows imported/skipped counts and per-row errors.
- **Export**: Applications page → "Export" for CSV or JSON of applications, or a full JSON export of all your data (applications, companies, interviews, contacts, notes, reminders, activity). Settings → Data also offers a quick CSV export. All exports are scoped to the authenticated user only.

## Troubleshooting

| Symptom                                                     | Likely cause                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blank page / console error about `createClient`             | `js/config.js` is missing — copy it from `config.example.js`                                                                                                                  |
| "Supabase client library not found"                         | The CDN `<script>` tag in `index.html` failed to load (check network/ad-blockers)                                                                                             |
| Sign-in fails with "Invalid login credentials"              | Wrong email/password, or email confirmation is required and pending                                                                                                           |
| Nothing happens after "Create account"                      | Your Supabase project requires email confirmation — check the inbox, or disable confirmation under Authentication settings for local testing                                  |
| Password reset link doesn't return you to the app correctly | Add your app's URL to **Authentication → URL Configuration → Redirect URLs**                                                                                                  |
| Queries return empty even though data exists                | RLS policy mismatch, or you're signed in as a different user than the one who created the data                                                                                |
| "new row violates row-level security policy"                | Expected behavior if a payload's `user_id` doesn't match `auth.uid()` — the frontend always stamps the correct id via `api.js`, so this usually means a stale/expired session |
| CORS errors calling an Edge Function                        | Confirm the function is deployed and `_shared/cors.ts` headers are present in its response                                                                                    |
| Edge Function returns 401                                   | Missing/expired `Authorization` header — the Supabase client should attach this automatically via `supabase.functions.invoke`                                                 |
| Database errors on migration                                | Run migrations in order (`001` → `004`); re-running is safe due to `if not exists` guards, but triggers use `drop … if exists` + `create` so they can be re-applied too       |

## License

MIT
