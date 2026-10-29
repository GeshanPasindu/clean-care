import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";
import Client from "../models/clientModel.js";
import { adminScope, invoiceScope } from "../middleware/authorization.js";

export const addInvoice = async (req, res) => {
  const { invoiceTitle, invoiceDescription, sendDate, client, notes } = req.body || {};
  const amount = req.body?.amount;
  if (typeof invoiceTitle !== "string" || !invoiceTitle.trim() || typeof invoiceDescription !== "string" || !invoiceDescription.trim()) {
    return res.status(400).json({ message: "Invoice title and description are required" });
  }
  if (!mongoose.isValidObjectId(client)) return res.status(400).json({ message: "A valid client is required" });
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) return res.status(400).json({ message: "Amount must be a non-negative number" });
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) return res.status(400).json({ message: "Notes must be text with no more than 2000 characters" });
  try {
    const clientExists = await Client.findOne({ _id: client, ...(await adminScope(req)) }).select("_id");
    if (!clientExists) return res.status(404).json({ message: "Client not found" });
    const invoice = await Invoice.create({
      invoiceTitle: invoiceTitle.trim(),
      invoiceDescription: invoiceDescription.trim(),
      sendDate,
      client: clientExists._id,
      amount: amount === undefined ? undefined : Number(amount),
      notes: typeof notes === "string" ? notes.trim() : undefined,
    });
    return res.status(201).json({ response_code: 201, success: true, message: "Invoice added successfully", newInvoice: invoice });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updatedInvoice = async (req, res) => {
  const { invoiceTitle, invoiceDescription, sendDate, client, amount, notes } = req.body || {};
  if (client !== undefined && !mongoose.isValidObjectId(client)) return res.status(400).json({ message: "Invalid client id" });
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) return res.status(400).json({ message: "Amount must be a non-negative number" });
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) return res.status(400).json({ message: "Notes must be text with no more than 2000 characters" });
  try {
    if (client !== undefined && !(await Client.exists({ _id: client, ...(await adminScope(req)) }))) {
      return res.status(404).json({ message: "Client not found" });
    }
    const updates = { invoiceTitle, invoiceDescription, sendDate, client, amount: amount === undefined ? undefined : Number(amount), notes: typeof notes === "string" ? notes.trim() : notes };
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, ...(await invoiceScope(req)) },
      { $set: Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "Invoice updated successfully", updatedInvoice: invoice });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getInvoiceById = async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...(await invoiceScope(req)) }).populate("client");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice fetched successfully", invoice });
};

export const getAllInvoices = async (req, res) => {
  const { startDate, endDate } = req.query;
  const query = { ...(await invoiceScope(req)) };
  if (startDate || endDate) {
    if (typeof startDate !== "string" || typeof endDate !== "string") return res.status(400).json({ message: "Both startDate and endDate are required" });
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return res.status(400).json({ message: "Invalid date range" });
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    query.sendDate = { $gte: start, $lte: end };
  }
  const invoices = await Invoice.find(query).populate({ path: "client", select: "firstName lastName" }).sort({ createdAt: -1 });
  return res.status(200).json({ response_code: 200, success: true, message: "Invoices fetched successfully", invoices });
};

export const updateStatus = async (req, res) => {
  const { invoiceStatus } = req.body || {};
  if (!["Pending", "Done"].includes(invoiceStatus)) return res.status(400).json({ message: "Invalid invoice status" });
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, ...(await invoiceScope(req)) },
    { $set: { invoiceStatus } },
    { new: true, runValidators: true }
  );
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice status updated successfully", invoice });
};

export const deleteInvoiceById = async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, ...(await invoiceScope(req)) });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Invoice deleted successfully" });
};
