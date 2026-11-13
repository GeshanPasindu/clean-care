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

## Rate limits and deleted accounts

The API defaults to 600 requests per IP per 15 minutes. Authentication routes use 120 requests per IP per 15 minutes, with sign-in additionally limited to 10 attempts per IP per 15 minutes. Deployments with multiple backend instances should configure a shared rate-limit store such as Redis.

Users are soft-deleted first. Schedule `npm run auth:purge-deleted-users` to permanently purge accounts older than `USER_DELETION_RETENTION_DAYS`; the purge removes sessions and anonymizes retained payroll snapshots.
