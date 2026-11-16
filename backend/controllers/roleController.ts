import { roleService } from "../services/roleService.js";
import {
  createRoleBodySchema,
  updateRoleBodySchema,
  roleListQuerySchema,
} from "../validation/role.js";
import { validatedController as handle } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  idParamsSchema as id,
} from "../validation/common.js";

export const getRoles = handle(
  request(empty, empty, roleListQuerySchema),
  async (input, _user, _req, res) => {
    const roles = await roleService.getRoles(input.query);
    return res.status(200).json({ success: true, roles });
  },
);

export const getAssignableRoles = handle(
  request(empty, empty, empty),
  async (_input, user, _req, res) => {
    const roles = await roleService.getAssignableRoles(user);
    return res.status(200).json({ success: true, roles });
  },
);

export const getPermissions = handle(
  request(empty, empty, empty),
  async (_input, _user, _req, res) => {
    const permissions = await roleService.getPermissions();
    return res.status(200).json({ success: true, permissions });
  },
);

export const createRole = handle(
  request(createRoleBodySchema, empty, empty),
  async (input, user, _req, res) => {
    const role = await roleService.create(input.body, user);
    return res
      .status(201)
      .json({ success: true, message: "Role created successfully", role });
  },
);

export const updateRole = handle(
  request(updateRoleBodySchema, id, empty),
  async (input, user, _req, res) => {
    const role = await roleService.update(input.params.id, input.body, user);
    return res
      .status(200)
      .json({ success: true, message: "Role updated successfully", role });
  },
);

export const deleteRole = handle(
  request(empty, id, empty),
  async (input, _user, _req, res) => {
    await roleService.remove(input.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Role deactivated successfully" });
  },
);
