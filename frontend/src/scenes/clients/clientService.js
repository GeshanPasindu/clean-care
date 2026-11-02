import { apiRequest } from "../../services/apiClient";

export const clientService = {
  getAll: () => apiRequest("client/getAllClient"),
  getAllActive: () => apiRequest("client/getAllActiveClient"),
  getById: (id) => apiRequest(`client/getClientById/${encodeURIComponent(id)}`),
  create: (values) => apiRequest("client/addClient", { method: "POST", body: values }),
  update: (id, values) =>
    apiRequest(`client/updateClientById/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: values,
    }),
  remove: (id) =>
    apiRequest(`client/deleteClientById/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateStatus: (id, clientStatus) =>
    apiRequest(`client/updateStatus/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { clientStatus },
    }),
  getCount: () => apiRequest("client/getAllClientCount"),
};
