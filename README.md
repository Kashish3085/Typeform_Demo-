# Typeform Clone

A full-stack clone of Typeform: a drag-and-drop form builder with live preview, a shareable public link, the animated one-question-at-a-time respondent experience, and a results dashboard.

| Layer    | Tech                                                         |
| -------- | ------------------------------------------------------------ |
| Frontend | Next.js 14 (App Router) · TypeScript · plain CSS · dnd-kit   |
| Backend  | Python · FastAPI · SQLAlchemy 2.0 · Pydantic v2              |
| Database | SQLite                                                       |

## Quick start

**Prerequisites:** Python 3.11+, Node 18+.

PowerShell (run each server in its own terminal):

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8010
```

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

The frontend proxies `/api/*` requests to `BACKEND_API_URL` on the Next.js server, so browser requests stay same-origin and do not depend on CORS. The default target is `http://127.0.0.1:8010`; override it in `frontend/.env.local` if needed. Run only one Next.js dev server for this project at a time.

On first boot the backend creates the tables and **seeds** demo data: two workspaces ("My workspace" and "Events"), two published forms (all 8 question types, 18 responses incl. a few abandoned ones, one dark-themed) and one draft.

Open http://localhost:3000 for the landing page. Sign up for a real account, or log in with the seeded demo account `demo@example.com` / `demo1234` (override with env `DEMO_PASSWORD`; **change or disable it on any public deployment**).

> **Upgrading from an earlier copy?** `forms.workspace_id`, `users.password_hash` and the `auth_sessions` table are new and there are no migrations - delete `backend/typeform.db` so it is recreated and re-seeded.

Run tests: `cd backend && pytest -q`  ·  Type-check: `cd frontend && npm run typecheck`

## Features

- **Builder**: add / edit inline / delete / drag-and-drop reorder questions; 8 types (short text, long text, multiple choice incl. multi-select, dropdown, email, number, yes/no, rating); required toggle, description, per-type options; live preview pane + full-screen preview; autosave with "Saving… / Saved" indicator.
- **Dashboard** (Typeform-style shell): top bar, product tabs, left rail with **workspaces** (create / rename / delete / switch, move forms between them), search, plan-usage meter; **List and Grid** views, sort (date created / last updated / name), Responses / Completed (completion %) / Updated columns; dismissible template suggestion cards that create real forms.
- **Form management**: create (blank or from a template) / rename / duplicate / delete / move, publish / unpublish, copy public link.
- **Typeform AI panel** (mock): a rule-based assistant that recognises "quiz", "feedback", "contact", "event" and creates a form from the matching template. There is no language model behind it.
- **Respondent flow** (`/f/<slug>`, no auth): full-screen, one question at a time, animated transitions, Enter / ↑ / ↓ navigation, A-B-C / Y-N / 1-5 shortcuts, progress bar, client **and** server validation, thank-you screen.
- **Results**: summary stats per question (bar charts, averages, completion rate), responses table, single-response view, delete, **CSV export**.
- **Bonus implemented**: custom themes (colors, font, presets), CSV export, completion rate (partial responses are seeded), multi-select.
- **Placeholders ("Coming soon")**: Contacts, Automations, Insights, Pages and Research Flow tabs, Integrations, Brand kit, plans/billing, Invite, logic jumps, file-upload/payment questions.

## Architecture

```
frontend/ (Next.js)                         backend/ (FastAPI)
  app/            routes (pages)              app/main.py        app, CORS, lifespan (create tables + seed)
  components/     UI by feature               app/routers/       HTTP layer only: parse, authorise, return
    builder/      sidebar, canvas, panels       forms.py         creator CRUD, publish, questions
    respondent/   FormRunner, QuestionInput     public.py        unauthenticated fill endpoints
    results/      summary, table, drawer        responses.py     results, stats, CSV
  lib/            api client, types, validation app/crud.py        business logic + queries
                                              app/question_types.py  validation rules per type
                                              app/schemas.py     Pydantic request/response contract
                                              app/models.py      SQLAlchemy ORM
```

Design decisions:

- **Thin routers, fat `crud.py`**: handlers only translate HTTP; logic is reusable and testable.
- **One runner, two uses**: the same `FormRunner` powers the public page and the builder preview, so what you preview is exactly what respondents get.
- **Server is the source of truth for validation**; the client mirrors the rules for instant feedback. The API returns per-question errors (`422 {errors: {question_id: msg}}`) so the UI jumps to the offending question.
- **Public vs. private surface**: creators use integer ids under `/api/forms/...`; respondents use an unguessable 8-char **slug** under `/api/public/...`, which returns a trimmed schema and a 404 for drafts.
- **Real email + password auth**: passwords hashed with stdlib scrypt (params stored in the hash, constant-time compare, dummy-hash verify for unknown emails so timing doesn't reveal which emails exist). Login returns an opaque random bearer token; only its SHA-256 is stored in `auth_sessions` (30-day expiry, deleted on logout). Failed logins are throttled (5 per 15 min per email, in memory, per process). Every creator query is scoped to the user; other users' resources return 404.
- **Token storage trade-off**: the token lives in `localStorage` (simple, works across origins, but readable by XSS). An HttpOnly cookie plus CSRF protection would be stronger; this is the known trade-off.
- **Pages**: `/` landing, `/signup`, `/login` (split-screen), `/dashboard` and `/forms/...` behind a `RequireAuth` guard; `?next=` is validated to prevent open redirects.

## Database schema

```
users 1──* workspaces 1──* forms 1──* questions
                           forms 1──* responses 1──* answers *──1 questions
```

| Table       | Key columns |
| ----------- | ----------- |
| `users`     | `id`, `name`, `email` (unique) |
| `workspaces`| `id`, `user_id` FK, `name` (a folder of forms; deleting one cascades to its forms) |
| `forms`     | `id`, `user_id` FK, `workspace_id` FK, `title`, `status` (draft/published), `slug` (unique, indexed), welcome + thank-you copy, theme columns, `created_at`, `updated_at`, `published_at` |
| `questions` | `id`, `form_id` FK, `type`, `title`, `description`, `required`, `position`, `properties` (JSON: choices, max, min, placeholder…) |
| `responses` | `id`, `form_id` FK, `started_at`, `submitted_at` (NULL = abandoned) |
| `answers`   | `id`, `response_id` FK, `question_id` FK, `value` (JSON), **UNIQUE(response_id, question_id)** |

Choices worth defending:

- **JSON for `properties` / `value`**: each question type has different config and answer shape (string, number, bool, list). A column-per-type or EAV design would add joins for no benefit; the relational skeleton (who owns what, one answer per question per response) is still strictly normalised and constrained.
- **`ON DELETE CASCADE`** everywhere + `PRAGMA foreign_keys=ON` (SQLite ignores FKs by default).
- **Indexes** on `forms(user_id, updated_at)`, `questions(form_id, position)`, `responses(form_id, submitted_at)`, `answers(question_id)`, `forms(slug)`.
- **Choice answers store choice *ids***, not labels, so renaming a choice doesn't corrupt old data.
- **`submitted_at IS NULL`** models partial responses → completion rate.
- A `UTCDateTime` column type stores naive UTC and returns tz-aware values so JSON timestamps carry a `Z`.

## API overview

Auth: `POST /api/auth/signup` (201, 409 on duplicate email), `POST /api/auth/login` (401 / 429 throttled), `POST /api/auth/logout` (204), `GET /api/auth/me`. All creator endpoints below require `Authorization: Bearer <token>` (401 otherwise).

Creator:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET / POST | `/api/forms` | list (`?workspace_id=`; includes response count + completion %) / create (blank, or `template`) |
| POST | `/api/forms/{id}/move` | move a form to another workspace |
| GET / POST | `/api/workspaces` | list (with form counts) / create |
| PATCH / DELETE | `/api/workspaces/{id}` | rename / delete (409 if it is your only one) |
| GET | `/api/usage` | responses collected vs. the (mock) plan limit |
| GET / PATCH / DELETE | `/api/forms/{id}` | read / update title, screens, theme / delete |
| POST | `/api/forms/{id}/duplicate` | copy as a new draft |
| POST | `/api/forms/{id}/publish` · `/unpublish` | change status (publish validates titles) |
| POST | `/api/forms/{id}/questions` | add (optional `position`) |
| PUT | `/api/forms/{id}/questions/order` | reorder: `{ordered_ids: [...]}` |
| PATCH / DELETE | `/api/questions/{id}` | edit / delete a question |
| GET | `/api/forms/{id}/responses` · `/responses/{rid}` | table rows / full response |
| DELETE | `/api/forms/{id}/responses/{rid}` | delete a response |
| GET | `/api/forms/{id}/summary` | per-question stats + completion rate |
| GET | `/api/forms/{id}/export.csv` | CSV download (formula-injection safe) |

Public (no auth):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/public/forms/{slug}` | published form (404 if draft/unknown) |
| POST | `/api/public/forms/{slug}/responses` | submit; `201` or `422` with per-question errors |

Interactive docs: `http://localhost:8010/docs`.

## Deployment

The frontend and API are separate services. Deploy the backend with a persistent PostgreSQL database, then deploy the Next.js frontend. Do not use SQLite on an ephemeral host: user accounts and forms can be lost on restart/redeploy.

### Backend (Render or another Python host)

- Create a Python web service with **root directory** `backend`, **build command** `pip install -r requirements.txt`, and **start command** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Provision PostgreSQL and set `DATABASE_URL` to its connection URL. Both `postgres://` and `postgresql://` URLs are supported.
- Set `SEED_ON_START=0` for a real deployment. Set a strong, unique `DEMO_PASSWORD` and `SEED_ON_START=1` only if you deliberately want the sample demo account and seeded data.
- Confirm the service health check at `/api/health`.

### Frontend (Vercel)

- Import the GitHub repository and set the project **root directory** to `frontend`.
- Set the build environment variable `BACKEND_API_URL` to the deployed backend's origin (for example, `https://your-api.example.com`, with no trailing slash).
- Deploy. The Next.js rewrite proxies `/api/*` to this backend URL; no `NEXT_PUBLIC_API_URL` or browser-side CORS configuration is needed.

After deployment, register a real account on the frontend and test creating and publishing a form. Never use the seeded demo credentials on a public deployment.

## Assumptions, mocks & limitations

**Mocked / simplified**
- Google/Microsoft sign-in and password reset show an informational message; only email/password authentication is implemented.
- **Seed data is fictional**: names, emails and answers are generated for the demo (fixed random seed, so it is reproducible). Seeding only runs when the database is empty (`SEED_ON_START=0` disables it).
- **Placeholders ("Coming soon")**: logic jumps/branching, integrations/webhooks, team sharing, file-upload and payment question types. They are UI placeholders only; nothing is wired behind them.
- No email, webhook or analytics service is called anywhere.

**Assumptions**
- The plan limit shown in the left rail (`PLAN_RESPONSE_LIMIT` in `crud.py`), "View plans", "Increase response limit", Integrations, Brand kit and Invite are placeholders: there is no billing or teams.
- The Typeform AI panel is rule-based (keyword -> template), not an LLM.
- Dashboard layout follows a screenshot of Typeform's dashboard; the builder, respondent and results screens are from memory and not yet compared to the real app.
- Only completed submissions count as "responses"; abandoned/partial rows are only present in seed data (the public flow does not create them yet).
- Duplicating a form copies its questions and settings, not its responses.
- Visual match to Typeform was done by hand from observation of its layout, interactions and animation; it is approximate, not pixel-exact, and uses no Typeform assets or code.
- SQLite is fine for this scope; swap `DATABASE_URL` for Postgres to scale (no SQLite-specific SQL is used).
- The UI is built to feel like Typeform (layout, interactions, animation) but uses original CSS, copy and assets.

### Auth, landing and branding additions

- **Not functional**: "Continue with Google/Microsoft" buttons (toast only), "Forgot your password?" (toast only), no email verification, no password-reset flow.
- Landing/auth pages use their own name, logo and fictional customer names ("Northfield Gym" etc.) and say they are not affiliated with Typeform; the layout mirrors the reference, the brand assets do not.
- The login throttle is in-memory, so it resets on restart and is per-process.
- CSV export downloads via authenticated `fetch` (a plain link cannot send the header).
