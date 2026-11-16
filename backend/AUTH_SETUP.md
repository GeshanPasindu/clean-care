# Authentication and user accounts

The backend is TypeScript. Development, build commands, validation, and the source review map are in [README.md](./README.md). Existing `auth:*` commands now run their TypeScript scripts through `tsx`; install development dependencies before running these local maintenance commands.

## Account model

Every person who can sign in is stored in the single `User` collection. This includes platform superadmins, tenant administrators or supervisors, and paid employees. Account identity, profile, employment, and bank details are fields on that User record.

Each User has one `role` reference. Roles are stored in `Role`; their allowed actions are the `Permission` records linked through `RolePermission`. Authorization checks those permissions on API routes. Role scope is used for data boundaries: `platform` spans all tenants, `tenant` owns a tenant's business records, and `staff` is limited to assigned work. These scopes do not create separate account models.

Clients are business records in the `Client` collection. They do not have login credentials, roles, or access to the platform. Client and job records belong to a tenant User through `tenantId`.

## Environment

Set these values in `backend/.env`:

- `MONGO_URI`: MongoDB connection string.
- `ACCESS_TOKEN_SECRET`: random secret with at least 32 characters. `SECRET` is accepted as a temporary fallback; deployments should set and rotate `ACCESS_TOKEN_SECRET`.
- `FRONTEND_ORIGINS`: comma-separated exact frontend origins. Development defaults to `http://localhost:3000`.
- `AUTH_COOKIE_SAME_SITE`: defaults to `lax`. Use `none` only when frontend and API are on different sites; `none` requires HTTPS.
- `AUTH_COOKIE_SECURE`: set to `true` for HTTPS. It is enabled automatically in production.
- `USER_DELETION_RETENTION_DAYS`: required by the scheduled soft-deleted-account purge command; an integer from 1 to 3650.

Set `VITE_API_URL` in `frontend/.env` to the backend API base URL, for example `http://localhost:4000/api/`.

The refresh cookie is HttpOnly and scoped to `/api/auth`. Access tokens stay in frontend memory and expire after 10 minutes. Refresh sessions rotate tokens, expire after 30 days of inactivity, and have a 90-day absolute lifetime.

## Initial setup

Run these commands from the backend folder after configuring `MONGO_URI`:

```powershell
npm run auth:seed-access-control
npm run auth:create-super-admin
```

The seed command creates or refreshes the built-in Super Admin, Admin, and Staff roles and their permission assignments. The bootstrap command creates a platform superadmin as an ordinary User with the platform role. It prompts for credentials and does not allow another platform account through the bootstrap flow.

For local account recovery, use the account email as an argument. The command revokes active sessions after resetting the password:

```powershell
npm run auth:reset-password -- admin@example.com
```

## User API

Account operations are under `/api/users`; there are no separate admin or staff account routes. Examples:

- `GET /api/users` and `GET /api/users/:id`: list or fetch accounts within the caller's scope.
- `POST /api/users`: create an account. Superadmins choose its role; tenant administrators automatically create Staff accounts in their tenant.
- `PUT /api/users/:id`: update profile and employment details where permitted.
- `PATCH /api/users/:id/role`: superadmins separately change a user's role or supervisor.
- `PATCH /api/users/:id/status`, `DELETE /api/users/:id`, `POST /api/users/:id/restore`: change status or soft-delete and restore an account.
- `PUT /api/users/:id/password`: reset another account's password when permitted.
- `GET /api/users/me`, `PUT /api/users/me`, `PUT /api/users/me/password`: read or update the authenticated account.

Authentication endpoints under `/api/auth` handle login, token refresh, logout, and logout-all. They return session information; account management remains on `/api/users`.

## First-login invitations

New accounts created through `POST /api/users` must replace their temporary password before accessing the app. Set `FRONTEND_APP_URL` to the frontend's canonical origin, for example `http://localhost:3000` locally or `https://app.example.com` in production, and include that origin in `FRONTEND_ORIGINS`. Production invitations require HTTPS. If `FRONTEND_APP_URL` is omitted, the first configured frontend origin is used; local development otherwise defaults to `http://localhost:3000`.

After creation, a one-time confirmation shows separate **Copy login link** and **Copy temporary password** controls. Share these separately. The password can be admin-entered or generated. It is hashed in the database and is never returned by the API; the creation page temporarily retains the entered value for copying. Closing the confirmation clears it from that page. The account's existing role and supervisor creation rules still apply.

The link opens `/first-login#token=...`. Its 256-bit random token stays in the URL fragment, and the page removes that fragment from the address bar after reading it into memory. Reopen the original invitation if the page is refreshed before setup finishes. Only a SHA-256 token digest and 24-hour expiry are stored on the User record. There is no TTL index that could delete an account.

The user enters the separately supplied temporary password and chooses a different permanent password. `POST /api/auth/first-login` validates the request before calling the service, enforces trusted origins and a dedicated attempt limit, checks the token, expiry, account/role state and temporary password, revokes existing sessions, and atomically consumes the invitation while replacing the password hash. It does not issue a session. The user then signs in normally. Expired, replaced and previously used links cannot complete setup.

The backend refuses normal sessions, token refresh and protected API access while `mustChangePassword` is true. Valid temporary credentials submitted to normal login return `FIRST_LOGIN_REQUIRED` and instructions to use the invitation. User-edit payloads cannot change this flag or invitation fields. Existing accounts and the locally provisioned Super Admin keep their current login flow.

For expired links or a lost temporary password, open the pending user's account and choose **Replace first-login credentials**. This generates a new temporary password and link, invalidates the previous credentials, and opens the copy dialog. The endpoint is `POST /api/users/:id/first-login-invitation`, with a Zod-validated `{ password }` body. It requires `users.password.reset`, the same user access boundary as other account management, and an active account still awaiting setup. It cannot reopen a completed account. The ordinary password-reset endpoint invalidates any pending invitation; use the replacement action to issue usable first-login credentials afterwards.

Invitations are shared manually through the copy controls. No email is sent automatically and no email configuration is needed for this flow. Restart both applications after updating; no permission seed or reset of existing accounts is required.

## Rate limits and deleted accounts

The API defaults to 600 requests per IP per 15 minutes. Authentication routes use 120 requests per IP per 15 minutes, with sign-in additionally limited to 10 attempts per IP per 15 minutes. Deployments with multiple backend instances should configure a shared rate-limit store such as Redis.

Users are soft-deleted first. Schedule `npm run auth:purge-deleted-users` to permanently purge accounts older than `USER_DELETION_RETENTION_DAYS`; the purge removes sessions and anonymizes retained payroll snapshots.

## Employee payments and supervisor salaries

For an existing database, run this once from `backend`, then refresh the session or sign in again:

```powershell
npm run auth:seed-payment-permissions
```

This adds `salaries.read`, `salaries.manage`, and `salaries.record` to the built-in Super Admin role without replacing other role assignments. It removes personal-payment access from platform roles. New installations can use the full access-control seed instead. The backend initializes the new payment/salary indexes during startup; restart it after updating.

`Employee Payments` (`/employee-payments`) has Cleaner Payments and Supervisor Salaries tabs. Cleaner management uses `payroll.read` / `payroll.record`; supervisors can manage only cleaners under their supervision. Salary management is initially Super Admin only, with the three salary permissions separately delegable through Roles. Employees cannot manage their own payments, even with management permissions. Platform accounts have no personal payments.

Cleaners support Daily, Per job, Weekly, and Monthly payments. These group completed shifts using their recorded hours and individual job rates; Daily does not introduce a fixed day rate. Per-job payouts require a completed assigned job. Other periods group shifts by sign-in date in Asia/Colombo time. Weekly periods run Monday–Sunday. Account pay frequency is a preference; it can be selected when preparing a cleaner payment.

Supervisor salaries use a fixed amount per week or calendar month and an effective date. The first payable period must start on or after that date; there is no automatic proration. Existing pending and paid amounts are snapshots. Overlapping salary periods are rejected, including when a salary plan changes frequency.

Prepare a payment after reviewing its calculated preview. Pending work is reserved against every payout frequency. Mark Paid records the payment date, method, optional reference, actor and timestamp, and issues a PAID receipt. This records an externally completed payment; it does not transfer funds. Pending payments can be cancelled to release work; paid receipts cannot be changed or cancelled. Changed work must be prepared again. Inactive or soft-deleted employees' existing pending records can still be settled or cancelled within the same access boundaries.

`My Payments` shows only the authenticated cleaner's or supervisor's paid receipts, with printing. Existing `StaffPayroll` receipts remain readable; new writes use `EmployeePayment` and `SalaryPlan`, both referencing the common User model. The old `/api/job/staffPayroll/:staffId` endpoints return 410. Paid receipt history prevents job deletion. Account purging anonymizes retained payment snapshots and removes pending payments and salary settings.

The new API is `/api/payments`: list records, `/employees` for paginated employee selection, `/employees/:employeeId/jobs` for paginated completed job selection, `/employees/:employeeId/salary` for salary settings, `/preview`, create a pending record, `/:id/paid`, cancel `/:id`, and `/me/receipts`. Payloads are Zod-validated before services; their inferred DTOs live in `types/requests.ts`. Amounts and payout ownership are computed on the server. Unique work/day reservation indexes and conditional pending-status updates prevent duplicate recording.

Payment history is the source of truth if updating a job's payment totals fails. Paid work records persist a `jobTotalsPending` flag; managers can use **Update job totals** in payment history, including after closing the original payment dialog. `PATCH /api/payments/:id/synchronize` accepts no financial payload, requires the same record permission and employee access as Mark Paid, and rejects pending records. A retry only updates job totals and retry metadata; the amount, payment date, paid actor, timestamps and receipt number remain unchanged. Historical `StaffPayroll` receipts stay read-only. Managers with read permission can inspect pending payment details without recording a payment or generating a paid receipt.
