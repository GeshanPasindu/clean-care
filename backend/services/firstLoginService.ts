import { createHash, randomBytes } from "node:crypto";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
import type { CompleteFirstLoginInput } from "../types/requests.js";
import type { FirstLoginInvitation } from "../types/onboarding.js";
import { referenceId } from "../utils/references.js";
import { hashPassword, verifyPasswordAndUpgrade } from "./credentialService.js";
import { revokeUserSessions } from "./sessionService.js";
import { ServiceError } from "./serviceError.js";

const lifetimeMs = 24 * 60 * 60 * 1000;
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function frontendOrigin(): string {
  const configured =
    process.env.FRONTEND_APP_URL ||
    process.env.FRONTEND_ORIGINS?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ServiceError(
      "Configure FRONTEND_APP_URL before creating invitations",
      503,
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new ServiceError(
      "FRONTEND_APP_URL must be the application's origin (HTTPS in production)",
      503,
    );
  return url.origin;
}
export function createFirstLoginInvitation(): {
  invitation: FirstLoginInvitation;
  tokenHash: string;
} {
  const url = new URL("/first-login", frontendOrigin());
  const token = randomBytes(32).toString("base64url");
  url.hash = new URLSearchParams({ token }).toString();
  return {
    invitation: {
      url: url.toString(),
      expiresAt: new Date(Date.now() + lifetimeMs),
    },
    tokenHash: digest(token),
  };
}

const invalidInvitation = () =>
  new ServiceError(
    "Invitation or temporary password is invalid or expired. Ask your administrator for new first-login credentials.",
    400,
  );
export const firstLoginService = {
  async complete(input: CompleteFirstLoginInput) {
    const tokenHash = digest(input.token);
    const user = await User.findOne({
      firstLoginTokenHash: tokenHash,
      firstLoginExpiresAt: { $gt: new Date() },
      mustChangePassword: true,
      status: "active",
      isDeleted: false,
    }).select("+password +firstLoginTokenHash +firstLoginExpiresAt");
    const validPassword = await verifyPasswordAndUpgrade(
      user,
      input.temporaryPassword,
    );
    if (
      !user ||
      !validPassword ||
      !(await Role.exists({ _id: referenceId(user.role), isActive: true }))
    )
      throw invalidInvitation();
    if (input.newPassword === input.temporaryPassword)
      throw new ServiceError(
        "Choose a different password from the temporary password",
        400,
      );
    const password = await hashPassword(input.newPassword);
    // Keep the invitation usable if session revocation fails, and claim it atomically afterwards.
    await revokeUserSessions(user._id);
    const activated = await User.findOneAndUpdate(
      {
        _id: user._id,
        password: user.password,
        role: referenceId(user.role),
        firstLoginTokenHash: tokenHash,
        firstLoginExpiresAt: { $gt: new Date() },
        mustChangePassword: true,
        status: "active",
        isDeleted: false,
      },
      {
        $set: { password, mustChangePassword: false },
        $unset: { firstLoginTokenHash: "", firstLoginExpiresAt: "" },
      },
      { new: true, runValidators: true },
    ).select("_id");
    if (!activated) throw invalidInvitation();
  },
};
