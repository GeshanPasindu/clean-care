import { clientService } from "../services/clientService.js";
import { ServiceError } from "../services/serviceError.js";
import { sendServiceError } from "./controllerError.js";

export const addClient = async (req, res) => {
  try {
    const newClient = await clientService.create(req.body, req.user);
    return res.status(201).json({ response_code: 201, success: true, message: "Client added successfully", newClient });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateClientById = async (req, res) => {
  try {
    const updatedClient = await clientService.update(req.params.id, req.body, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Client updated successfully", updatedClient });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const deleteClientById = async (req, res) => {
  try {
    await clientService.remove(req.params.id, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Client deleted successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await clientService.getById(req.params.id, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Client fetched successfully", client });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getAllClient = async (req, res) => {
  const clients = await clientService.getAll(req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Clients fetched successfully", clients });
};

export const getAllClientCount = async (req, res) => {
  const count = await clientService.count(req.user);
  return res.status(200).json({ response_code: 200, success: true, count });
};

export const getAllActiveClient = async (req, res) => {
  const clients = await clientService.getActive(req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Active clients fetched successfully", clients });
};

export const getAllClientPagination = async (req, res) => {
  try {
    const { clients, paginationInfo } = await clientService.getPaginated(req.query, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Clients fetched successfully", clients, paginationInfo });
  } catch (error) {
    if (error instanceof ServiceError) return res.status(error.statusCode).json({ message: error.message });
    throw error;
  }
};

export const updateStatus = async (req, res) => {
  const client = await clientService.updateStatus(req.params.id, req.body?.clientStatus, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Client updated successfully", client });
};
