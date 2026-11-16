# Backend development

The backend uses strict TypeScript, Express, Mongoose, and Zod. Configure `backend/.env` as described in [AUTH_SETUP.md](./AUTH_SETUP.md).

Run commands from `backend/`:

```powershell
npm install
npm run dev
```

`dev` watches TypeScript files with `tsx`. `npm start` runs the TypeScript entry point once. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Checks and production build

```powershell
npm run type-check
npm test
npm run build
npm run start:prod
```

`type-check` checks all backend source and tests, rejects explicit unrestricted types, detects inferred unrestricted variable/parameter types, and rejects compiler suppression comments. Strict compiler options also reject implicit parameter types and unused declarations. Third-party declaration files are outside the source restriction.

`build` runs those checks and emits application and maintenance-script JavaScript into `dist/`. Tests and the type-check utility are excluded from build output. `start:prod` runs `dist/index.js`; build before starting it. The build needs development dependencies; the compiled server can run with production dependencies alone.

Tests use HTTP requests and mocked database operations. They do not connect to or change a database. They cover request validation, authentication responses, cookie settings, permission boundaries, Staff-only job assignment, and inherited job visibility.

## Request flow

```text
Route -> authentication/permissions/ownership -> Zod validation
      -> controller -> service -> Mongoose model -> response
```

`middleware/validatedController.ts` parses the request body, route parameters, and query together. A controller only receives the parsed result. `validatedService` applies the same boundary for the job services' shared context. Login validates credentials before calling the authentication service. Authentication guards and ownership checks remain in place.

Zod failures return HTTP 400 with field paths:

```json
{
  "message": "Request validation failed",
  "issues": [{ "path": "body.assignedStaff", "message": "..." }]
}
```

Schemas normalize numeric form strings into numbers, date strings into `Date` objects where the service expects dates, and blank optional profile dates into `null`. Payment dates and date-range filters remain validated strings for the existing service date handling. Date filters use `YYYY-MM-DD`; dates also support ISO date-time strings. Unknown object fields are stripped. Role and supervisor fields are explicitly rejected on the general user-update endpoint; use the role-assignment endpoint.

Database-dependent checks stay in services: whether a record exists, who can access it, which accounts may be assigned to jobs, and whether a payment exceeds the balance.

Job billing uses `orgNoOfhours` (billable hours) and `orgHourRate` (the hourly rate charged to the client). `staffRates` must provide an explicit hourly pay rate for every assigned cleaner; rates may differ between cleaners. Changing the assignment list requires a complete rate map. Partial updates to other fields preserve existing assignment rates. New jobs and edits do not use a default staff rate. The old stored `staffHourRate` field is read only to reconstruct historical jobs that lack assignment records; recorded shift rates and paid payroll remain intact.

## Review map

| Location                                                          | Responsibility                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tsconfig.json`, `tsconfig.build.json`, `package.json`            | Strict checks, development commands, production output                                |
| `types/domain.ts`                                                 | Shared identifiers, statuses, role scopes, authenticated user, service context/result |
| `types/requests.ts`                                               | Service input types inferred from Zod outputs; do not duplicate request interfaces    |
| `types/models.ts`                                                 | Stored records, populated references, and response projections                        |
| `types/jobs.ts`, `types/http.ts`                                  | Payroll/timesheet results and HTTP boundaries                                         |
| `validation/`                                                     | Reusable validators and feature request schemas                                       |
| `middleware/validatedController.ts`, `middleware/errorHandler.ts` | Parsing before services and consistent validation responses                           |
| `controllers/`                                                    | Validated input, service calls, HTTP responses                                        |
| `services/`, `models/`                                            | Typed business operations and database records                                        |
| `app.ts`, `index.ts`                                              | Express setup and database/server startup respectively                                |
| `tests/`                                                          | Request and authorization regression checks                                           |

Source imports retain `.js` extensions intentionally: NodeNext resolves them to TypeScript during development and the emitted JavaScript during production.

First-login setup uses `services/firstLoginService.ts`, the common User model's private invitation fields, and `validation/auth.ts` / `types/requests.ts` for the completion DTO. New account creation always requires a password change. Authentication checks that requirement at session creation, refresh and access-token lookup. Invitation tokens are hashed, expire after 24 hours, and are consumed atomically; temporary passwords are never recoverable from the API. Configuration and replacement actions are documented in [AUTH_SETUP.md](./AUTH_SETUP.md#first-login-invitations).

## Adding an endpoint

1. Define its body, params, and query schemas in the feature's `validation/` file. Reuse `validation/common.ts` and the domain constants.
2. Export the service DTO from `types/requests.ts` using `z.output<typeof schema>` so transforms and service types agree.
3. Use `validatedController` or `validatedService`, then pass only the parsed values to the service.
4. Add shared record/result types under `types/` when needed. Narrow unknown external values instead of bypassing the compiler.
5. Run the checks above. Maintenance commands and account setup are documented in [AUTH_SETUP.md](./AUTH_SETUP.md).

## Employee payments

Payment routes/controllers are in `employeePaymentRoute.ts` / `employeePaymentController.ts`. `services/employeePaymentService.ts` prepares pending payments, records paid receipts and manages salary plans; `paymentAccessService.ts` enforces employee/manager boundaries. Request contracts are in `validation/payments.ts`, their inferred service inputs in `types/requests.ts`, common persisted records in `types/payments.ts`, and Colombo calendar periods in `utils/paymentPeriods.ts`. `EmployeePayment` reserves individual shifts across Daily, PerJob, Weekly and Monthly cleaner payments. Salary plans support Weekly and Monthly with overlapping calendar-day reservations. Paid work records track pending job-total updates, which can be retried through the dedicated synchronize endpoint without changing payment details. No extra identity models are introduced.

See [payment setup and behavior](./AUTH_SETUP.md#employee-payments-and-supervisor-salaries) before updating an existing database. Tests use mocks and do not seed permissions, initialize database indexes, or change live records.
