import { clientService } from "../services/clientService.js";
import {
  createClientBodySchema,
  updateClientBodySchema,
  clientStatusBodySchema,
  clientListQuerySchema,
} from "../validation/client.js";
import { validatedController as handle } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  idParamsSchema as id,
} from "../validation/common.js";

export const addClient = handle(
  request(createClientBodySchema, empty, empty),
  async (input, user, _req, res) => {
    const newClient = await clientService.create(input.body, user);
    return res
      .status(201)
      .json({
        response_code: 201,
        success: true,
        message: "Client added successfully",
        newClient,
      });
  },
);

export const updateClientById = handle(
  request(updateClientBodySchema, id, empty),
  async (input, user, _req, res) => {
    const updatedClient = await clientService.update(
      input.params.id,
      input.body,
      user,
    );
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Client updated successfully",
        updatedClient,
      });
  },
);

export const deleteClientById = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    await clientService.remove(input.params.id, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Client deleted successfully",
      });
  },
);

export const getClientById = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    const client = await clientService.getById(input.params.id, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Client fetched successfully",
        client,
      });
  },
);

export const getAllClient = handle(
  request(empty, empty, empty),
  async (_input, user, _req, res) => {
    const clients = await clientService.getAll(user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Clients fetched successfully",
        clients,
      });
  },
);

export const getAllClientCount = handle(
  request(empty, empty, empty),
  async (_input, user, _req, res) => {
    const count = await clientService.count(user);
    return res.status(200).json({ response_code: 200, success: true, count });
  },
);

export const getAllActiveClient = handle(
  request(empty, empty, empty),
  async (_input, user, _req, res) => {
    const clients = await clientService.getActive(user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Active clients fetched successfully",
        clients,
      });
  },
);

export const getAllClientPagination = handle(
  request(empty, empty, clientListQuerySchema),
  async (input, user, _req, res) => {
    const result = await clientService.getPaginated(input.query, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Clients fetched successfully",
        ...result,
      });
  },
);

export const updateStatus = handle(
  request(clientStatusBodySchema, id, empty),
  async (input, user, _req, res) => {
    const client = await clientService.updateStatus(
      input.params.id,
      input.body.clientStatus,
      user,
    );
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Client updated successfully",
        client,
      });
  },
);
