# Authentication setup

## Environment

Set these values in `backend/.env`:

- `MONGO_URI`: the MongoDB connection string.
- `ACCESS_TOKEN_SECRET`: a randomly generated secret with at least 32 characters. The server accepts the existing `SECRET` variable as a temporary fallback, but deployments should set `ACCESS_TOKEN_SECRET` and rotate the old secret.
- `FRONTEND_ORIGINS`: comma-separated exact frontend origins. The development default is `http://localhost:3000`.
- `AUTH_COOKIE_SAME_SITE`: `lax` by default. Use `none` only when the frontend and API are on different sites; `none` requires HTTPS.
- `AUTH_COOKIE_SECURE`: set to `true` when serving HTTPS. It is enabled automatically when `NODE_ENV=production`.

Set `REACT_APP_API_URL` for the frontend when the API is not at `http://localhost:4000/api`.

The refresh cookie is HttpOnly and scoped to `/api/auth`. Access tokens stay in frontend memory and expire after 10 minutes. Refresh sessions rotate tokens, expire after 30 days of inactivity, and have a 90-day absolute lifetime.

## Rate limits

The API uses `express-rate-limit` with a default limit of 600 requests per IP per 15 minutes. Authentication routes have a limit of 120 requests per IP per 15 minutes, and sign-in is additionally limited to 10 attempts per IP per 15 minutes. The default in-memory store is suitable for a single backend process; deployments with multiple backend instances should use a shared rate-limit store such as Redis so limits are consistent across instances.

## Initial superAdmin and account recovery

The application is configured for at most one superAdmin account. The authenticated user-creation API cannot assign the `superAdmin` role. A partial unique database index enforces this rule, including for direct database writes.

Before deploying this constraint to an existing database, run the index setup command. It stops if it finds more than one superAdmin account so the records can be reviewed before any index is created:

```powershell
npm run auth:ensure-single-super-admin
```

Create the first superAdmin from the backend folder using an interactive terminal. The password is masked while typing, and the command refuses to create a second account:

```powershell
npm run auth:create-super-admin
```

To reset an existing account password locally, use the account email as an argument. The reset revokes that account's active sessions:

```powershell
npm run auth:reset-password -- admin@example.com
```

The application has no public superAdmin registration or password-reset endpoint. A superAdmin can create subsequent admin accounts from the application.
