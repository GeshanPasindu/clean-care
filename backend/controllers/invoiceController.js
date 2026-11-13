import { invoiceService } from "../services/invoiceService.js";
import { sendServiceError } from "./controllerError.js";

export const addInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.create(req.body, req.user);
    return res.status(201).json({ response_code: 201, success: true, message: "Invoice added successfully", newInvoice: invoice });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updatedInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.update(req.params.id, req.body, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Invoice updated successfully", updatedInvoice: invoice });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getInvoiceById = async (req, res) => {
  const invoice = await invoiceService.getById(req.params.id, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice fetched successfully", invoice });
};

export const getAllInvoices = async (req, res) => {
  const result = await invoiceService.getAll(req.query, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Invoices fetched successfully", ...result });
};

export const updateStatus = async (req, res) => {
  const invoice = await invoiceService.updateStatus(req.params.id, req.body?.invoiceStatus, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice status updated successfully", invoice });
};

export const deleteInvoiceById = async (req, res) => {
  await invoiceService.remove(req.params.id, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice deleted successfully" });
};
