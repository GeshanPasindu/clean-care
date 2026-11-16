import type { AuthenticatedUser, AccountStatus } from "../types/domain.js";
import type { CreateClientInput, UpdateClientInput, PaginationQuery } from "../types/requests.js";
import { pickDefined } from "../utils/objects.js";
import Client from "../models/clientModel.js";
import { getTenantIdForUser, tenantDataScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";

const clientFields = [
  "firstName", "lastName", "email", "address", "phoneNumber", "contactName",
  "contactPhoneNumber", "contactEmail", "accountManager", "notes",
] as const;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parsePage = (value: number | undefined, fallback: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const selectClientFields = (body: Partial<CreateClientInput>) => pickDefined(body, clientFields);

export const clientService = {
  async create(body: CreateClientInput, user: AuthenticatedUser) {
    const fields = selectClientFields(body);
    const tenantId = await getTenantIdForUser(user);
    if (!tenantId) throw new ServiceError("A tenant account is required to create clients", 403);
    if (!fields.firstName || !fields.email || !fields.address || !fields.phoneNumber) {
      throw new ServiceError("Client name, email, address, and phone are required", 400);
    }
    if (typeof fields.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      throw new ServiceError("A valid email is required", 400);
    }
    fields.email = fields.email.trim().toLowerCase();
    if (await Client.findOne({ email: fields.email })) {
      throw new ServiceError("Client already exists", 409);
    }

    return Client.create({ ...fields, tenantId });
  },

  async update(id: string, body: UpdateClientInput, user: AuthenticatedUser) {
    const fields = selectClientFields(body);
    if (fields.email !== undefined) fields.email = String(fields.email).trim().toLowerCase();
    const updatedClient = await Client.findOneAndUpdate(
      { _id: id, ...(await tenantDataScope({ user })) },
      { $set: fields },
      { new: true, runValidators: true }
    );
    if (!updatedClient) throw new ServiceError("Client not found", 404);
    return updatedClient;
  },

  async remove(id: string, user: AuthenticatedUser) {
    const deletedClient = await Client.findOneAndDelete({ _id: id, ...(await tenantDataScope({ user })) });
    if (!deletedClient) throw new ServiceError("Client not found", 404);
    return deletedClient;
  },

  async getById(id: string, user: AuthenticatedUser) {
    const client = await Client.findOne({ _id: id, ...(await tenantDataScope({ user })) });
    if (!client) throw new ServiceError("Client not found", 404);
    return client;
  },

  async getAll(user: AuthenticatedUser) {
    return Client.find(await tenantDataScope({ user })).sort({ createdAt: -1 });
  },

  async count(user: AuthenticatedUser) {
    return Client.countDocuments(await tenantDataScope({ user }));
  },

  async getActive(user: AuthenticatedUser) {
    return Client.find({ ...(await tenantDataScope({ user })), clientStatus: "active" }).sort({ createdAt: -1 });
  },

  async getPaginated({ page: rawPage, limit: rawLimit, search: rawSearch = "" }: Partial<PaginationQuery>, user: AuthenticatedUser) {
    if (rawSearch !== "" && typeof rawSearch !== "string") {
      throw new ServiceError("Invalid search", 400);
    }
    const search = rawSearch.trim().slice(0, 100);
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 10, 100);
    const scope = await tenantDataScope({ user });
    const searchFilter = search
      ? { $or: ["firstName", "lastName", "address"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) }
      : {};
    const query = { ...scope, ...searchFilter };
    const [totalResult, clients] = await Promise.all([
      Client.countDocuments(query),
      Client.find(query).skip((page - 1) * limit).sort({ createdAt: -1 }).limit(limit),
    ]);

    return {
      clients,
      paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
    };
  },

  async updateStatus(id: string, clientStatus: AccountStatus, user: AuthenticatedUser) {
    if (!["active", "inactive"].includes(clientStatus)) {
      throw new ServiceError("Invalid client status", 400);
    }
    const client = await Client.findOneAndUpdate(
      { _id: id, ...(await tenantDataScope({ user })) },
      { $set: { clientStatus } },
      { new: true, runValidators: true }
    );
    if (!client) throw new ServiceError("Client not found", 404);
    return client;
  },
};
