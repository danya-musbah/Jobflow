# Software Requirements Specification (SRS)

## 1. Introduction

This document defines the functional and non-functional requirements for JobFlow, a job application tracking application built as a static frontend and powered by Supabase. The system supports user authentication, job tracking, interviews, contact management, notes, reminders, analytics, and CSV import/export workflows.

The purpose of this specification is to capture the requirements that are realized by the implementation and to clarify the operational assumptions of the system.

## 2. System purpose and scope

### 2.1 Purpose

The purpose of JobFlow is to help a user manage the job search process from initial interest to final outcome in one private, organized system.

### 2.2 Scope

In scope:

- user authentication and session management
- job application management
- interview tracking
- contact tracking
- notes and reminders
- dashboard analytics and funnel reporting
- CSV export/import support
- data isolation per user through database security policies

Out of scope for the current implementation:

- multi-tenant SaaS admin dashboards
- complex role management beyond single-user account ownership
- native mobile app packaging
- advanced AI-driven recommendations or automation

## 3. Definitions and abbreviations

- App: the web application running in the browser
- RLS: Row Level Security, the database access constraint model used by Supabase
- User: a person identified by an authenticated Supabase account
- Application: a tracked job opportunity
- Company: an employer or organization associated with an application
- Interview: a scheduled recruitment interview tied to an application
- Contact: recruiter or hiring manager associated with a company or application
- Dashboard: the lifecycle summary view of tracked jobs

## 4. Project context and usage description

JobFlow is intended for individual job seekers who need a clear overview of their job search. The application focuses on operational visibility: what was applied to, which stage it is in, which follow-ups are due, and how the overall pipeline is performing.

Users interact with the system from a browser. The app loads a Supabase client, checks for an active session, and either renders the auth flow or the main dashboard. All persistent data is stored in the user’s Supabase project, with each record owned by the authenticated user.

## 5. User roles and permissions

### 5.1 User roles

- Standard authenticated user: can create, read, update, and delete their own records

### 5.2 Access rules

- Users may view only records linked to their own `user_id`
- Users may not view or modify other users’ applications, contacts, or reminders
- Authenticated users may reset their password through the standard recovery flow
- Account deletion is only possible through the optional Edge Function when deployed correctly

## 6. Operating environment and platform support

### 6.1 Environment

- Browser-based static web app
- Supabase-managed PostgreSQL database and authentication services
- Optional Deno-based Edge Functions for server-side processing

### 6.2 Supported platforms

- Modern desktop browsers
- Modern mobile browsers with responsive layout support
- Static hosting providers such as GitHub Pages, Netlify, or Vercel

## 7. Assumptions, dependencies, and constraints

- The app depends on a valid Supabase project and database schema
- A browser with JavaScript enabled is required
- The project uses a public anon key, which is safe to expose in the browser only when protected by RLS
- The service-role key is not permitted in frontend code and is only used in server-side Edge Functions
- There is no local database or build step required for the normal frontend workflow

## 8. Functional requirements

### FR-001: User sign-up

The system shall allow a user to create an authenticated account using email and password.

Acceptance criteria:

- The form validates email and password requirements
- A new Supabase auth user is created
- A matching `profiles` row is created automatically when the trigger is enabled
- The user sees a success or confirmation state

### FR-002: User sign-in

The system shall allow an authenticated user to sign in with valid credentials.

Acceptance criteria:

- Invalid login attempts return a clear error
- Successful sign-in loads the main app shell
- Session state persists across reloads

### FR-003: Password reset

The system shall allow a user to initiate and complete password recovery.

Acceptance criteria:

- The app sends a reset email for a valid account
- The recovery link returns the user into the reset flow
- The user can set a new password

### FR-004: User sign-out

The system shall allow the current user to sign out.

Acceptance criteria:

- The session is terminated
- The app returns to the auth screen
- Sidebar and app state reset appropriately

### FR-005: Application list view

The system shall show the user’s tracked applications in a searchable, sortable, filterable list.

Acceptance criteria:

- Applications are listed in table form
- Search filters by title, location, and company data
- Results can be sorted by selected columns
- Pagination is available when the dataset exceeds the page limit

### FR-006: Application Kanban view

The system shall support a Kanban board representation of applications by status.

Acceptance criteria:

- Each status has a column
- Application cards show job information and state
- Drag-and-drop style status handling is supported through the application interface

### FR-007: Application create and edit

The system shall allow users to add and update applications.

Acceptance criteria:

- A form captures required data such as job title and company name
- Validations reject invalid URLs, dates, and salary ranges
- The new application is persisted to the database associated with the current user
- Updated records are reflected in the interface

### FR-008: Application delete

The system shall allow a user to delete an application.

Acceptance criteria:

- A confirmation prompt appears before deletion
- The application and associated dependent records are removed or cleaned up according to schema rules
- The UI refreshes and removes the deleted item

### FR-009: Interview tracking

The system shall allow users to create and manage interview entries for an application.

Acceptance criteria:

- Interview items include type, date/time, and duration
- They are displayed with the relevant application context
- Interview data can be edited or deleted

### FR-010: Contact management

The system shall allow users to create, view, update, and delete contacts.

Acceptance criteria:

- Contacts can include name, company, email, phone, LinkedIn URL, and notes
- Contact records are displayed in a searchable card layout
- Users can delete contacts after confirmation

### FR-011: Notes and activity recording

The system shall support notes and a basic activity trail linked to applications.

Acceptance criteria:

- Users can add notes to an application
- The system records creation and update events in the activity table
- The timeline remains associated with the application and user

### FR-012: Reminders

The system shall allow users to create reminders tied to an application.

Acceptance criteria:

- Reminders include a title and due date/time
- Dashboard grouping distinguishes overdue, today, tomorrow, and upcoming entries
- Reminder data is associated with the relevant application

### FR-013: Dashboard summary

The system shall provide a dashboard summarizing job-search status.

Acceptance criteria:

- Total counts and conversion metrics are displayed
- Funnel stages show counts by application status
- Reminder groups are visible on the dashboard

### FR-014: Analytics

The system shall provide analytics based on real application data.

Acceptance criteria:

- Response, interview, and offer rates are calculated from tracked applications
- Funnel and stage summaries are displayed
- Charts and metrics are derived from the user’s records

### FR-015: CSV import

The system shall allow users to import job applications from a CSV file.

Acceptance criteria:

- CSV parsing accepts the expected fields
- Data is mapped into application records
- Import results are surfaced to the user
- Invalid rows are handled with a clear error path

### FR-016: CSV export

The system shall allow users to export application data as CSV.

Acceptance criteria:

- The export includes application data in a spreadsheet-friendly format
- The downloaded file uses a clear filename
- Users can trigger export from the app interface

### FR-017: Settings management

The system shall support user profile, preferences, and data management controls.

Acceptance criteria:

- Users can update name, timezone, and default app preferences
- Users can trigger password-reset email flow
- Users can export data or request account deletion when the server-side function is available

## 9. Non-functional requirements

### NFR-001: Security and privacy

User data shall be isolated by user and must never be exposed across user accounts.

### NFR-002: Data integrity

The system shall validate required fields and constraints before persisting edits.

### NFR-003: Responsiveness

The interface should remain usable on common mobile and desktop browser sizes.

### NFR-004: Accessibility

Core controls shall use semantic HTML, labels, and keyboard-friendly interactions where feasible.

### NFR-005: Maintainability

The code is organized into focused modules so that UI, validation, API, and database concerns are separated.

### NFR-006: Deployment simplicity

The default implementation shall work as a static frontend without requiring a custom Node-based application server.

## 10. User interface and UX requirements

- The app shall present two main states: authentication and application workspace
- Navigation shall allow access to dashboard, applications, interviews, contacts, analytics, and settings
- Forms shall show inline validation feedback for required and invalid data
- The interface shall use a consistent design system for buttons, cards, tables, and filters
- Empty-state messaging shall be shown when no records exist

## 11. Integration requirements

- The frontend shall integrate with Supabase Auth for sign-in and sign-up
- The frontend shall use PostgREST queries through a shared client layer
- Optional server-side work shall use Supabase Edge Functions for heavy processing or admin operations

## 12. Data requirements

The application manages records for profiles, companies, applications, interviews, contacts, notes, reminders, and activity logs. The schema requires a one-to-many or many-to-one structure consistent with ownership by user ID.

## 13. Security and privacy requirements

- Private records must use user ownership checks in the database layer
- The browser must never contain the service-role key
- Reset and authentication flows must use the configured Supabase redirect URLs
- All user-owned data must be protected by RLS

## 14. Core usage scenarios

### Primary flow

1. The user signs in
2. They add a job application
3. They update status as progress changes
4. They add interviews and notes
5. They review dashboard and analytics
6. They export data when needed

### Exception flow

- Invalid email or password input is rejected
- Missing required fields are blocked with inline validation
- Deletion requires confirmation to avoid accidental data loss
- Failed database or auth operations are displayed as user-visible errors

## 15. Acceptance criteria summary

- Users can create an account and sign in
- The dashboard updates from real data
- Application CRUD operations work for the logged-in user
- Interview, contact, note, and reminder flows work inside the same user scope
- Analytics and exports operate using actual application data
- Public configuration is limited to safe Supabase values only

## 16. Known constraints and future requirements

### Known constraints

- This is a single-user personal tracking system rather than a collaborative HR platform
- Some advanced features depend on optional server-side Edge Functions being deployed
- There is no formal automated test suite in the repository at this time

### Future requirements

- Advanced reporting filters and saved views
- Automated reminder notifications
- Bulk editing tools for applications
- More advanced CSV schema validation and mapping
- Better onboarding demos and seeded data configuration

## 17. Requirement traceability

- Security model and user isolation: FR-001, FR-002, NFR-001
- Application lifecycle: FR-005, FR-006, FR-007, FR-008, FR-013, FR-014
- Interviews and contacts: FR-009, FR-010
- Follow-ups and notes: FR-011, FR-012
- Export and import: FR-015, FR-016
- Settings and account controls: FR-017
