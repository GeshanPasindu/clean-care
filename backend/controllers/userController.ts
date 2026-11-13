import { authService } from "../services/authService.js";
import { userService } from "../services/userService.js";
import { clearRefreshCookie } from "../config/authCookie.js";
import { changePasswordBodySchema } from "../validation/auth.js";
import {
  createUserBodySchema,
  updateUserBodySchema,
  updateProfileBodySchema,
  changeRoleBodySchema,
  userStatusBodySchema,
  resetPasswordBodySchema,
  userListQuerySchema,
  userCountQuerySchema,
} from "../validation/user.js";
import { validatedController as handle } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  idParamsSchema as id,
  paginationQuerySchema,
} from "../validation/common.js";

export const createUser = handle(
  request(createUserBodySchema, empty, empty),
  async (input, user, _req, res) => {
    const result = await userService.create(input.body, user);
    return res
      .status(201)
      .json({
        success: true,
        message: "User created successfully",
        user: result,
      });
  },
);

export const getUser = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    const result = await userService.getById(input.params.id, user);
    return res.status(200).json({ success: true, user: result });
  },
);

export const getMe = handle(
  request(empty, empty, empty),
  async (_input, user, _req, res) => {
    const result = await userService.getMe(user);
    return res.status(200).json({ success: true, user: result });
  },
);

export const getAllUsers = handle(
  request(empty, empty, userListQuerySchema),
  async (input, user, _req, res) => {
    const result = await userService.getAll(user, input.query);
    return res.status(200).json({ success: true, ...result });
  },
);

export const getUserCount = handle(
  request(empty, empty, userCountQuerySchema),
  async (input, user, _req, res) => {
    const count = await userService.count(user, input.query.scope);
    return res.status(200).json({ success: true, count });
  },
);

export const getDeletedUsers = handle(
  request(empty, empty, paginationQuerySchema),
  async (input, user, _req, res) => {
    const result = await userService.getDeleted(user, input.query);
    return res.status(200).json({ success: true, ...result });
  },
);

export const updateUser = handle(
  request(updateUserBodySchema, id, empty),
  async (input, user, _req, res) => {
    const result = await userService.update(input.params.id, input.body, user);
    return res
      .status(200)
      .json({
        success: true,
        message: "User updated successfully",
        user: result,
      });
  },
);

export const changeUserRole = handle(
  request(changeRoleBodySchema, id, empty),
  async (input, user, _req, res) => {
    const result = await userService.changeRole(
      input.params.id,
      input.body,
      user,
    );
    return res
      .status(200)
      .json({
        success: true,
        message: "User role updated successfully",
        user: result,
      });
  },
);

export const updateMe = handle(
  request(updateProfileBodySchema, empty, empty),
  async (input, user, _req, res) => {
    const result = await userService.updateSelf(user, input.body);
    return res
      .status(200)
      .json({
        success: true,
        message: "Profile updated successfully",
        user: result,
      });
  },
);

export const updateUserStatus = handle(
  request(userStatusBodySchema, id, empty),
  async (input, user, _req, res) => {
    const result = await userService.updateStatus(
      input.params.id,
      input.body.status,
      user,
    );
    return res
      .status(200)
      .json({ success: true, message: "Account status updated", user: result });
  },
);

export const resetUserPassword = handle(
  request(resetPasswordBodySchema, id, empty),
  async (input, user, _req, res) => {
    await userService.resetPassword(input.params.id, input.body.password, user);
    return res
      .status(200)
      .json({
        success: true,
        message: "Password updated. The user must sign in again.",
      });
  },
);

export const changeOwnPassword = handle(
  request(changePasswordBodySchema, empty, empty),
  async (input, user, _req, res) => {
    await authService.changePassword(
      user._id,
      input.body.currentPassword,
      input.body.newPassword,
    );
    clearRefreshCookie(res);
    return res
      .status(200)
      .json({
        success: true,
        message: "Password updated. Please sign in again.",
      });
  },
);

export const deleteUser = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    await userService.remove(input.params.id, user);
    return res
      .status(200)
      .json({ success: true, message: "User soft-deleted successfully" });
  },
);

export const restoreUser = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    await userService.restore(input.params.id, user);
    return res
      .status(200)
      .json({ success: true, message: "User restored in inactive status" });
  },
);
