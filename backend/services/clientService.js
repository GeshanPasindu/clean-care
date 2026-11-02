import Client from "../models/clientModel.js";
import { adminScope, getAdminProfileId } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";

const clientFields = [
  "firstName", "lastName", "email", "address", "phoneNumber", "contactName",
  "contactPhoneNumber", "contactEmail", "accountManager", "notes",
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parsePage = (value, fallback, max) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const selectClientFields = (body = {}) => Object.fromEntries(
  clientFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])
);

export const clientService = {
  async create(body, user) {
    const fields = selectClientFields(body);
    const adminId = await getAdminProfileId(user);
    if (!adminId) throw new ServiceError("An admin profile is required to create clients", 403);
    if (!fields.firstName || !fields.lastName || !fields.email || !fields.address || !fields.phoneNumber) {
      throw new ServiceError("Client name, email, address, and phone are required", 400);
    }
    if (typeof fields.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      throw new ServiceError("A valid email is required", 400);
    }
    fields.email = fields.email.trim().toLowerCase();
    if (await Client.findOne({ email: fields.email })) {
      throw new ServiceError("Client already exists", 409);
    }

    return Client.create({ ...fields, adminId });
  },

  async update(id, body, user) {
    const fields = selectClientFields(body);
    if (fields.email !== undefined) fields.email = String(fields.email).trim().toLowerCase();
    const updatedClient = await Client.findOneAndUpdate(
      { _id: id, ...(await adminScope({ user })) },
      { $set: fields },
      { new: true, runValidators: true }
    );
    if (!updatedClient) throw new ServiceError("Client not found", 404);
    return updatedClient;
  },

  async remove(id, user) {
    const deletedClient = await Client.findOneAndDelete({ _id: id, ...(await adminScope({ user })) });
    if (!deletedClient) throw new ServiceError("Client not found", 404);
    return deletedClient;
  },

  async getById(id, user) {
    const client = await Client.findOne({ _id: id, ...(await adminScope({ user })) });
    if (!client) throw new ServiceError("Client not found", 404);
    return client;
  },

  async getAll(user) {
    return Client.find(await adminScope({ user })).sort({ createdAt: -1 });
  },

  async count(user) {
    return Client.countDocuments(await adminScope({ user }));
  },

  async getActive(user) {
    return Client.find({ ...(await adminScope({ user })), clientStatus: "active" }).sort({ createdAt: -1 });
  },

  async getPaginated({ page: rawPage, limit: rawLimit, search: rawSearch = "" } = {}, user) {
    if (rawSearch !== "" && typeof rawSearch !== "string") {
      throw new ServiceError("Invalid search", 400);
    }
    const search = rawSearch.trim().slice(0, 100);
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 10, 100);
    const scope = await adminScope({ user });
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

  async updateStatus(id, clientStatus, user) {
    if (!["active", "inactive"].includes(clientStatus)) {
      throw new ServiceError("Invalid client status", 400);
    }
    const client = await Client.findOneAndUpdate(
      { _id: id, ...(await adminScope({ user })) },
      { $set: { clientStatus } },
      { new: true, runValidators: true }
    );
    if (!client) throw new ServiceError("Client not found", 404);
    return client;
  },
};
