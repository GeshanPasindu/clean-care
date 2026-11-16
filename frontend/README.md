# Frontend

The frontend is a Vite React application written in strict TypeScript. Forms use React Hook Form with Zod resolvers. TanStack Query owns server data; the authentication context owns the current session.

## Run and verify

Configure `VITE_API_URL` in `frontend/.env`, for example:

```dotenv
VITE_API_URL=http://localhost:4000/api/
```

Run from `frontend/`:

```powershell
npm install --legacy-peer-deps
npm run dev
npm run type-check
npm test
npm run build
```

The repository's existing Nivo packages have conflicting peer requirements, so installation currently needs `--legacy-peer-deps`. Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

Development uses port 3000. Restart an existing development server after the source/config renames. `build` runs the strict checks before producing `dist/`; `npm run preview` serves that production build. Node requirements are listed in `package.json`.

`type-check` checks source, tests, and configuration. It rejects explicit `any`, inferred unrestricted variable/parameter types, and TypeScript suppression comments. Values from untyped boundaries are narrowed or parsed with Zod. Third-party declaration files are outside the source restriction.

## Architecture and review map

| Location                                                    | Responsibility                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `types/domain.ts`                                           | Shared API record schemas and types: users, roles, clients, jobs, invoices, payroll, and receipts |
| `types/api.ts`                                              | Response envelopes, pagination, sessions, query parameters                                        |
| `types/requests.ts`                                         | Shared service inputs for account operations and attendance                                       |
| `validation/`                                               | Feature form schemas, defaults, and inferred form values; `common.ts` holds reusable validators   |
| `components/forms/FormField.tsx`                            | Typed React Hook Form controller for MUI fields, including field errors and focus refs            |
| `scenes/<feature>/`                                         | Feature pages, shared create/edit forms, and query hooks                                          |
| `services/`, feature service files                          | Typed API operations using the central transport                                                  |
| `queries/queryHelpers.ts`                                   | Typed TanStack Query/mutation wrappers and cache invalidation                                     |
| `auth/AuthContext.tsx`                                      | Session bootstrap, sign-in/out, current user, and permission helpers                              |
| `hooks/useDateRangeForm.ts`, `hooks/useWorkDescription.tsx` | Shared filter validation and the validated attendance sign-out dialog                             |
| `src/test/`, adjacent `*.test.ts` files                     | Form submission, API transport, response contract, and schema tests                               |

Most existing files retain their location and have been renamed from `.js`/`.jsx` to `.ts`/`.tsx`. Client, job, and invoice create/edit pages now wrap a shared feature form. The client jobs filename no longer contains a trailing space.

## Form and API flow

```text
MUI field -> React Hook Form -> Zod resolver -> validated submission values
          -> feature service -> central API client -> backend
          <- parsed response <- TanStack Query cache <- page
```

React Hook Form owns values, validation errors, submission state, and form resets. Create/edit pages load existing records through query hooks and call `reset` when data arrives. UI-only state such as dialogs, password visibility, table pages, and search text remains local state.

Schemas cover login, clients, jobs and individual staff rates, invoices, account creation/editing, role assignment/management, profile and password updates, payments, payroll periods, attendance descriptions, and date-range filters. Schemas convert numeric input strings to numbers before services receive them. Password characters are preserved; email and ordinary text normalization are explicit. Field errors appear beside inputs. Backend validation and authorization remain authoritative.

The job form separates the hourly rate charged to the client from hourly pay for each assigned cleaner. Every cleaner requires their own explicit rate. New selections start with a blank rate, and edits preserve each cleaner's existing rate. There is no default staff rate field or automatic pay-rate substitution.

Use `z.input<typeof schema>` for raw form values and `z.output<typeof schema>` for validated submission values when a schema transforms data. Avoid maintaining a separate handwritten interface for the same form. The shared `FormField` accepts only valid field paths for its control type.

The central API client reads only `VITE_API_URL`, adds bearer headers automatically, includes refresh cookies, deduplicates concurrent refresh requests, and retries protected requests after a successful refresh. Services supply a Zod response schema; response data enters the application only after parsing. Dates in API records are JSON strings. Populated references and ID-only references are normalized for views; deleted client references render as empty client details.

Account creation keeps the established rules: superadmins choose a role and a supervisor for Staff accounts; supervisors create Staff without submitting role assignments. Generated initial passwords remain available. Bank fields follow existing permissions. Clients remain business records.

Account creation now opens a one-time first-login credentials dialog with separate link/password copy buttons. The entered temporary password remains in component memory, the form is cleared, and the creation mutation is reset with immediate garbage collection. Closing the dialog discards the temporary credentials from that page. Authorized admins can replace credentials for pending accounts from the user detail page.

The public `/first-login` page uses React Hook Form and `validation/auth.ts` to validate a different new password and matching confirmation. It reads the invitation from the URL fragment, clears the fragment, and sends the token and passwords only in the first-login POST body. It creates no authenticated session; success returns the user to ordinary sign-in. Missing/expired invitations render a recovery message. The backend enforces the setup requirement on normal login, refresh and protected API authentication. See [first-login configuration](../backend/AUTH_SETUP.md#first-login-invitations).

## Adding a form

1. Put its schema and defaults in the feature's `validation/` module. Reuse shared validators and domain enums.
2. Derive the input and output types from that schema, then use `useForm` with `zodResolver`.
3. Bind MUI inputs with `FormField` or `Controller`. Submit through `handleSubmit`; pass its parsed values to the service.
4. Add/extend the service's response contract and invalidate relevant query keys after a mutation.
5. Test that invalid values block the service call and valid values reach it in the expected shape.

Tests mock API calls and do not create accounts, jobs, or payments in a database. Live backend/browser integration remains a separate check.

## Employee payments

`scenes/payments/EmployeePayments.tsx` provides paginated cleaner payments and supervisor salaries. `MyPayments.tsx` is the employee's paid-receipt view. `PaymentForms.tsx` uses React Hook Form and `validation/employeePayments.ts` for preparation, salary settings and payment confirmation. Services call only the configured backend through `services/employeePaymentService.ts`; response contracts are parsed from `types/payments.ts`. Query invalidation updates payment lists and job payment totals.

Cleaner frequencies are Daily, Per job, Weekly and Monthly. Per-job selection loads completed assigned jobs by page. Changing a selection hides the old preview and requires recalculation. The server calculates amounts and reserves included work. Mark Paid issues a printable PAID receipt; cancelling pending records releases work. Supervisors can manage their cleaners with payroll permissions. Fixed weekly/monthly supervisor salaries require separate salary permissions, initially assigned only to Super Admin. Platform accounts have no My Payments item; employees see only their own paid receipts. The Users table includes a Payments link when permitted.

Existing databases need the additive permission setup described in [backend setup](../backend/AUTH_SETUP.md#employee-payments-and-supervisor-salaries). Payment actions record money already transferred outside this application.

Managers can use **View details** to inspect a prepared payment's work breakdown with read permission. The Mark Paid dialog also shows that breakdown before confirmation. If updating job totals fails after a payment is saved, the paid record retains a retry indicator and an **Update job totals** action in payment history. Retrying calls the dedicated synchronization endpoint and never resubmits financial details. Paid receipts remain available throughout.
