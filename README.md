# Leafline Library Management System

A full-stack TypeScript library application using React, Vite, React Router, Tailwind CSS, Express, MongoDB Atlas and Mongoose. The interface supports English and Bangla, with React Query, React Hook Form, Zod, Recharts and Lucide icons.

## Requirements

- Node.js 22.12 or newer and npm
- MongoDB Atlas cluster and a database user
- SMTP credentials and a verified sender for password recovery and email-change verification

## MongoDB Atlas setup

1. Create an Atlas project and cluster in a region near your Vercel function region when practical.
2. Under **Database Access**, create a dedicated database user with `readWrite` access to the `Library` database.
3. Under **Network Access**, allow your current public IP for local development. For production, use Vercel Static IPs or an appropriate private network option; avoid `0.0.0.0/0` in production.
4. In Atlas, choose **Connect → Drivers → Node.js**, copy the SRV connection string, replace the password, and add `/Library` as the database path, for example `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/Library?retryWrites=true&w=majority`. Percent-encode reserved characters in the username/password.
5. Keep `MONGODB_URI` server-side. Never expose it with a `VITE_` prefix. Collections and indexes are created by Mongoose as needed.

See the [Atlas IP access list guide](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Node.js connection guide](https://www.mongodb.com/docs/atlas/driver-connection/) for the current console steps.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values below. `.env.local` is gitignored.
3. In Atlas, allow your development IP address.
4. Run `npm run seed:admin` to create the initial admin idempotently.
5. Run `npm run dev` and open the Vite URL, normally `http://localhost:5173`.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection URI for the `Library` database; server-only |
| `JWT_SECRET` | Random signing key of at least 32 characters |
| `SEED_ADMIN_NAME` | Initial administrator display name |
| `SEED_ADMIN_EMAIL` | Initial administrator email |
| `SEED_ADMIN_PASSWORD` | Initial administrator password (12+ characters recommended) |
| `APP_URL` | Public site origin used in mail links; HTTPS in production |
| `NODE_ENV` | `development` locally; Vercel sets `production` in production |
| `PORT` | Local API port, default `4000`; not used by Vercel |
| `VITE_API_BASE_URL` | Browser API prefix; defaults to `/api` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | Password reset expiry in whole minutes (5–120; default 30) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Email relay hostname, port and TLS setting |
| `SMTP_USER`, `SMTP_PASSWORD` | Email relay authentication |
| `MAIL_FROM` | Sender address/name accepted by your provider |

Configure all SMTP variables or leave the group unset to disable mail. `APP_URL` must be a public HTTPS origin in production. The seed command leaves an existing admin unchanged and refuses to convert a student account into an admin. Use unique, strong credentials and do not commit secrets.

## Email setup

Password recovery and email-change verification use SMTP. Add the SMTP variables above to `.env.local` locally or to **Vercel → Project Settings → Environment Variables** in deployment. The sender/domain may need provider verification and SPF/DKIM setup; follow the provider's instructions.

Mail templates are bilingual. Tokens are random, stored as SHA-256 hashes, single-use and expire after `PASSWORD_RESET_TOKEN_TTL_MINUTES` (default 30 minutes). The allowed TTL range is 5–120 minutes. Email changes do not take effect until the link sent to the proposed address is opened; the current address remains active in the meantime. Database-backed rate limits apply across serverless instances. Reset responses do not reveal whether an account exists.

## Vercel deployment

1. Push the project to a Git provider and import it into Vercel.
2. Add production environment variables in Vercel. Keep MongoDB, JWT and SMTP secrets server-side; use separate credentials/databases for Preview when appropriate.
3. Set `APP_URL` to the exact deployed HTTPS origin (including custom domain where used). `VITE_API_BASE_URL` normally remains `/api`.
4. Configure Atlas network access using the static egress addresses or private network feature supported by the deployment plan. Keep the database user scoped to `Library`.
5. Deploy. `vercel.json` builds the React frontend and TypeScript API, serves `dist`, routes `/api/*` to the Express serverless function in `api/index.ts`, and sends client-side routes to the SPA entry point.
6. Run `npm run seed:admin` from a trusted environment configured with production Atlas variables to initialize the administrator.

The Express API caches its Mongoose connection between warm invocations. Local development runs the same Express app on port 4000 and Vite proxies `/api`.

## Main workflows

- Public visitors can browse, search and filter books by title, ISBN, author, category and availability. Each book has a detail page with publisher, publication year, shelf location, cover URL and live availability.
- Students register with a generated student ID, sign in, borrow available books directly from the catalogue or book-detail page, view due dates and their own loan history, edit their name/phone, request an email change, and change or recover their password. Self-checkouts use the same transactional stock, duplicate-loan and loan-limit protections as admin issues.
- Administrators create/update/delete categories, authors and books; inspect and suspend/reactivate student accounts; view student loan history; issue books; and record returns.
- The default loan policy is 14 calendar days, ৳4 per overdue calendar day, and at most five active loans per student. Admins can update the loan period, daily fine and active-loan limit under **Library settings**. The server enforces policy and Asia/Dhaka calendar dates.
- MongoDB transactions protect inventory reservation, active-loan caps, return marking, fine persistence and audit writes against concurrent requests. A return can only be recorded once; inventory cannot be decremented below zero.
- Admin reports show live active/returned/overdue loans and fines, a six-month issue chart, date-filtered server-generated CSV, and issue/return administrator attribution. CSV exports are capped at 10,000 records and guard against spreadsheet formula injection.
- Audit records cover authentication, profile, password, email verification, settings, student status, catalog and circulation changes.
- Covers are stored as public image URLs. File upload requires a separate storage provider and is not implemented.

## Verification commands

- `npm test` — automated tests for loan dates, concurrent inventory/loan limits, duplicate returns, fine calculations, email/password reset tokens, SMTP configuration, persistent rate limits, authorization, inventory edits and Vercel path handling.
- `npm run lint` — ESLint for frontend, API, server and tests.
- `npm run build` — frontend TypeScript check and Vite production build.
- `npm run build:api` — Express/API TypeScript build checks.

A live Atlas workflow requires valid Atlas credentials and an IP/network allowlist. Password reset and email verification delivery additionally require a working SMTP provider and accepted sender. The repository includes Vercel serverless configuration; a deployed production smoke test and provider delivery test must be run in the owner's Vercel and email accounts. No credentials are included in this repository.

## Security notes

Passwords are bcrypt-hashed. Authentication uses a signed HttpOnly SameSite cookie, role authorization is checked server-side against the active account, and students can only read their own records. Inputs are validated with Zod, account and API limits are rate-limited, errors do not expose stack traces, API responses are `no-store`, and Helmet sets security headers. Do not commit `.env.local` or paste secret values into public logs.

## Add 30 computer-related sample books

Run `npm run seed:books` from the project root. The script reads `data/computer-books.json`, reuses or creates the related categories and authors, and inserts each book once. `LIB-COMP-0001` style values are internal catalog codes, not official ISBNs; replace them with the books' real ISBNs if available.
