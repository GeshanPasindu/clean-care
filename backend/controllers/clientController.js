import Client from "../models/clientModel.js";
import { adminScope, getAdminProfileId } from "../middleware/authorization.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parsePage = (value, fallback, max) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const clientFields = ["firstName", "lastName", "email", "address", "phoneNumber", "contactName", "contactPhoneNumber", "contactEmail", "accountManager", "notes"];
const clientUpdate = (body = {}) => Object.fromEntries(clientFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

export const addClient = async (req, res) => {
  try {
    const fields = clientUpdate(req.body);
    const adminId = await getAdminProfileId(req.user);
    if (!adminId) return res.status(403).json({ message: "An admin profile is required to create clients" });
    if (!fields.firstName || !fields.lastName || !fields.email || !fields.address || !fields.phoneNumber) {
      return res.status(400).json({ message: "Client name, email, address, and phone are required" });
    }
    if (typeof fields.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return res.status(400).json({ message: "A valid email is required" });
    }
    fields.email = fields.email.trim().toLowerCase();
    const existingClient = await Client.findOne({ email: fields.email });
    if (existingClient) return res.status(409).json({ message: "Client already exists" });

    const newClient = await Client.create({ ...fields, adminId });
    return res.status(201).json({ response_code: 201, success: true, message: "Client added successfully", newClient });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateClientById = async (req, res) => {
  try {
    const scope = await adminScope(req);
    const fields = clientUpdate(req.body);
    if (fields.email !== undefined) fields.email = String(fields.email).trim().toLowerCase();
    const updatedClient = await Client.findOneAndUpdate(
      { _id: req.params.id, ...scope },
      { $set: fields },
      { new: true, runValidators: true }
    );
    if (!updatedClient) return res.status(404).json({ message: "Client not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "Client updated successfully", updatedClient });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const deleteClientById = async (req, res) => {
  try {
    const deletedClient = await Client.findOneAndDelete({ _id: req.params.id, ...(await adminScope(req)) });
    if (!deletedClient) return res.status(404).json({ message: "Client not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "Client deleted successfully" });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, ...(await adminScope(req)) });
    if (!client) return res.status(404).json({ message: "Client not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "Client fetched successfully", client });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getAllClient = async (req, res) => {
  const clients = await Client.find(await adminScope(req)).sort({ createdAt: -1 });
  return res.status(200).json({ response_code: 200, success: true, message: "Clients fetched successfully", clients });
};

export const getAllClientCount = async (req, res) => {
  const count = await Client.countDocuments(await adminScope(req));
  return res.status(200).json({ response_code: 200, success: true, count });
};

export const getAllActiveClient = async (req, res) => {
  const clients = await Client.find({ ...(await adminScope(req)), clientStatus: "active" }).sort({ createdAt: -1 });
  return res.status(200).json({ response_code: 200, success: true, message: "Active clients fetched successfully", clients });
};

export const getAllClientPagination = async (req, res) => {
  const { page: rawPage, limit: rawLimit, search: rawSearch = "" } = req.query;
  if (rawSearch !== "" && typeof rawSearch !== "string") return res.status(400).json({ message: "Invalid search" });
  const search = rawSearch.trim().slice(0, 100);
  const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(rawLimit, 10, 100);
  const scope = await adminScope(req);
  const searchFilter = search ? { $or: ["firstName", "lastName", "address"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  const query = { ...scope, ...searchFilter };
  const [totalResult, clients] = await Promise.all([
    Client.countDocuments(query),
    Client.find(query).skip((page - 1) * limit).sort({ createdAt: -1 }).limit(limit),
  ]);
  return res.status(200).json({
    response_code: 200,
    success: true,
    message: "Clients fetched successfully",
    clients,
    paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
  });
};

export const updateStatus = async (req, res) => {
  const { clientStatus } = req.body || {};
  if (!["active", "inactive"].includes(clientStatus)) return res.status(400).json({ message: "Invalid client status" });
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, ...(await adminScope(req)) },
    { $set: { clientStatus } },
    { new: true, runValidators: true }
  );
  if (!client) return res.status(404).json({ message: "Client not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Client updated successfully", client });
};

