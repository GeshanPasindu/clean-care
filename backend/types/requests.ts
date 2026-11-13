import type { z } from "zod";
import type * as auth from "../validation/auth.js";
import type * as client from "../validation/client.js";
import type * as invoice from "../validation/invoice.js";
import type * as job from "../validation/job.js";
import type * as role from "../validation/role.js";
import type * as user from "../validation/user.js";
import type * as common from "../validation/common.js";

export type LoginInput = z.output<typeof auth.loginBodySchema>;
export type AccessTokenPayload = z.output<typeof auth.accessTokenPayloadSchema>;
export type CreateUserInput = z.output<typeof user.createUserBodySchema>;
export type UpdateUserInput = z.output<typeof user.updateUserBodySchema>;
export type UpdateProfileInput = z.output<typeof user.updateProfileBodySchema>;
export type ChangeRoleInput = z.output<typeof user.changeRoleBodySchema>;
export type UserListQuery = z.output<typeof user.userListQuerySchema>;
export type UserScope = z.output<typeof user.userCountQuerySchema>["scope"];
export type PaginationQuery = z.output<typeof common.paginationQuerySchema>;
export type CreateClientInput = z.output<typeof client.createClientBodySchema>;
export type UpdateClientInput = z.output<typeof client.updateClientBodySchema>;
export type CreateInvoiceInput = z.output<
  typeof invoice.createInvoiceBodySchema
>;
export type UpdateInvoiceInput = z.output<
  typeof invoice.updateInvoiceBodySchema
>;
export type InvoiceListQuery = z.output<typeof invoice.invoiceListQuerySchema>;
export type CreateRoleInput = z.output<typeof role.createRoleBodySchema>;
export type UpdateRoleInput = z.output<typeof role.updateRoleBodySchema>;
export type CreateJobInput = z.output<typeof job.createJobBodySchema>;
export type UpdateJobInput = z.output<typeof job.updateJobBodySchema>;
export type JobListQuery = z.output<typeof job.jobListQuerySchema>;
export type ClientJobQuery = z.output<typeof job.clientJobQuerySchema>;
export type TimesheetQuery = z.output<typeof job.timesheetQuerySchema>;
export type PayrollQuery = z.output<typeof job.payrollQuerySchema>;
export type PaymentInput = z.output<typeof common.paymentBodySchema>;
export type StaffPayoutInput = z.output<typeof job.staffPayoutBodySchema>;
export type PayrollInput = z.output<typeof job.payrollBodySchema>;
export type SignInInput = z.output<typeof job.signInBodySchema>;
export type SignOffInput = z.output<typeof job.signOffBodySchema>;
