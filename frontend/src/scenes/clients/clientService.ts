import { apiRequest } from "../../services/apiClient";
import type { QueryParams } from "../../types/api";
import {
  clientResultSchema,
  clientsSchema,
  countSchema,
  resultSchema,
} from "../../types/api";
import type { AccountStatus } from "../../types/domain";
import type { ClientValues } from "../../validation/forms";

export const clientService = {
  getAll: () => apiRequest("client/getAllClient", {}, clientsSchema),

  getPaginated: (params: QueryParams = {}) =>
    apiRequest("client/getAllClientPagination", { params }, clientsSchema),
  getAllActive: () =>
    apiRequest("client/getAllActiveClient", {}, clientsSchema),
  getById: (id: string | undefined) =>
    apiRequest(
      `client/getClientById/${encodeURIComponent(id || "")}`,
      {},
      clientResultSchema,
    ),
  create: (values: ClientValues) =>
    apiRequest(
      "client/addClient",
      { method: "POST", body: values },
      clientResultSchema,
    ),
  update: (id: string | undefined, values: ClientValues) =>
    apiRequest(
      `client/updateClientById/${encodeURIComponent(id || "")}`,
      {
        method: "PUT",
        body: values,
      },
      clientResultSchema,
    ),
  remove: (id: string) =>
    apiRequest(
      `client/deleteClientById/${encodeURIComponent(id || "")}`,
      {
        method: "DELETE",
      },
      resultSchema,
    ),
  updateStatus: (id: string, clientStatus: AccountStatus) =>
    apiRequest(
      `client/updateStatus/${encodeURIComponent(id || "")}`,
      {
        method: "PATCH",
        body: { clientStatus },
      },
      clientResultSchema,
    ),
  getCount: () => apiRequest("client/getAllClientCount", {}, countSchema),
};
