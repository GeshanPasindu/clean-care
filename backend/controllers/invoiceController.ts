import { invoiceService } from "../services/invoiceService.js";
import {
  createInvoiceBodySchema,
  updateInvoiceBodySchema,
  invoiceListQuerySchema,
  invoiceStatusBodySchema,
} from "../validation/invoice.js";
import { validatedController as handle } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  idParamsSchema as id,
} from "../validation/common.js";

export const addInvoice = handle(
  request(createInvoiceBodySchema, empty, empty),
  async (input, user, _req, res) => {
    const newInvoice = await invoiceService.create(input.body, user);
    return res
      .status(201)
      .json({
        response_code: 201,
        success: true,
        message: "Invoice added successfully",
        newInvoice,
      });
  },
);

export const updatedInvoice = handle(
  request(updateInvoiceBodySchema, id, empty),
  async (input, user, _req, res) => {
    const updatedInvoice = await invoiceService.update(
      input.params.id,
      input.body,
      user,
    );
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Invoice updated successfully",
        updatedInvoice,
      });
  },
);

export const getInvoiceById = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    const invoice = await invoiceService.getById(input.params.id, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Invoice fetched successfully",
        invoice,
      });
  },
);

export const getAllInvoices = handle(
  request(empty, empty, invoiceListQuerySchema),
  async (input, user, _req, res) => {
    const result = await invoiceService.getAll(input.query, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Invoices fetched successfully",
        ...result,
      });
  },
);

export const updateStatus = handle(
  request(invoiceStatusBodySchema, id, empty),
  async (input, user, _req, res) => {
    const invoice = await invoiceService.updateStatus(
      input.params.id,
      input.body.invoiceStatus,
      user,
    );
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Invoice status updated successfully",
        invoice,
      });
  },
);

export const deleteInvoiceById = handle(
  request(empty, id, empty),
  async (input, user, _req, res) => {
    await invoiceService.remove(input.params.id, user);
    return res
      .status(200)
      .json({
        response_code: 200,
        success: true,
        message: "Invoice deleted successfully",
      });
  },
);
