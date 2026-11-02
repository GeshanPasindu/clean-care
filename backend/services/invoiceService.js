import mongoose from "mongoose";
import Client from "../models/clientModel.js";
import Invoice from "../models/invoiceModel.js";
import { adminScope, invoiceScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";

const validateAmount = (amount) => {
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    throw new ServiceError("Amount must be a non-negative number", 400);
  }
};

const validateNotes = (notes) => {
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ServiceError("Notes must be text with no more than 2000 characters", 400);
  }
};

export const invoiceService = {
  async create(body = {}, user) {
    const { invoiceTitle, invoiceDescription, sendDate, client, notes, amount } = body;
    if (typeof invoiceTitle !== "string" || !invoiceTitle.trim() || typeof invoiceDescription !== "string" || !invoiceDescription.trim()) {
      throw new ServiceError("Invoice title and description are required", 400);
    }
    if (!mongoose.isValidObjectId(client)) throw new ServiceError("A valid client is required", 400);
    validateAmount(amount);
    validateNotes(notes);

    const clientExists = await Client.findOne({ _id: client, ...(await adminScope({ user })) }).select("_id");
    if (!clientExists) throw new ServiceError("Client not found", 404);

    return Invoice.create({
      invoiceTitle: invoiceTitle.trim(),
      invoiceDescription: invoiceDescription.trim(),
      sendDate,
      client: clientExists._id,
      amount: amount === undefined ? undefined : Number(amount),
      notes: typeof notes === "string" ? notes.trim() : undefined,
    });
  },

  async update(id, body = {}, user) {
    const { invoiceTitle, invoiceDescription, sendDate, client, amount, notes } = body;
    if (client !== undefined && !mongoose.isValidObjectId(client)) throw new ServiceError("Invalid client id", 400);
    validateAmount(amount);
    validateNotes(notes);

    if (client !== undefined && !(await Client.exists({ _id: client, ...(await adminScope({ user })) }))) {
      throw new ServiceError("Client not found", 404);
    }
    const updates = {
      invoiceTitle,
      invoiceDescription,
      sendDate,
      client,
      amount: amount === undefined ? undefined : Number(amount),
      notes: typeof notes === "string" ? notes.trim() : notes,
    };
    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, ...(await invoiceScope({ user })) },
      { $set: Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) },
      { new: true, runValidators: true }
    );
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },

  async getById(id, user) {
    const invoice = await Invoice.findOne({ _id: id, ...(await invoiceScope({ user })) }).populate("client");
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },

  async getAll(query = {}, user) {
    const { startDate, endDate } = query;
    const filter = { ...(await invoiceScope({ user })) };
    if (startDate || endDate) {
      if (typeof startDate !== "string" || typeof endDate !== "string") {
        throw new ServiceError("Both startDate and endDate are required", 400);
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        throw new ServiceError("Invalid date range", 400);
      }
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      filter.sendDate = { $gte: start, $lte: end };
    }
    return Invoice.find(filter)
      .populate({ path: "client", select: "firstName lastName" })
      .sort({ createdAt: -1 });
  },

  async updateStatus(id, invoiceStatus, user) {
    if (!["Pending", "Done"].includes(invoiceStatus)) throw new ServiceError("Invalid invoice status", 400);
    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, ...(await invoiceScope({ user })) },
      { $set: { invoiceStatus } },
      { new: true, runValidators: true }
    );
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },

  async remove(id, user) {
    const invoice = await Invoice.findOneAndDelete({ _id: id, ...(await invoiceScope({ user })) });
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },
};
