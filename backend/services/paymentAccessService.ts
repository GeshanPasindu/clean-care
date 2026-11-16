import type { AuthenticatedUser } from "../types/domain.js";
import type { RoleScope } from "../types/domain.js";
import { ServiceError } from "./serviceError.js";
export type PaymentAction = "read" | "record" | "manage";
export function paymentPermission(
  scope: "staff" | "tenant",
  action: PaymentAction,
): string {
  return scope === "staff"
    ? action === "read"
      ? "payroll.read"
      : "payroll.record"
    : `salaries.${action}`;
}
export function assertPaymentAccess(
  actor: AuthenticatedUser,
  target: {
    _id: { toString(): string };
    scope: RoleScope;
    tenantId: { toString(): string } | null;
  },
  action: PaymentAction,
): void {
  if (target.scope === "platform")
    throw new ServiceError(
      "Platform accounts do not receive employee payments",
      403,
    );
  if (actor.scope === "staff" || String(target._id) === actor._id)
    throw new ServiceError("You cannot manage your own payments", 403);
  if (!actor.permissions.includes(paymentPermission(target.scope, action)))
    throw new ServiceError("Access denied", 403);
  if (
    target.scope === "staff" &&
    actor.scope !== "platform" &&
    String(target.tenantId) !== (actor.tenantId || actor._id)
  )
    throw new ServiceError("Employee not found", 404);
}
