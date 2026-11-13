import type { FilterQuery } from "mongoose";
import type { AuthenticatedUser, PaymentStatus } from "../types/domain.js";
import type { InvoiceRecord } from "../types/models.js";
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceListQuery } from "../types/requests.js";
import mongoose from "mongoose";
import Client from "../models/clientModel.js";
import Invoice from "../models/invoiceModel.js";
import { invoiceScope, tenantDataScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";

const parsePage = (value: number | undefined, fallback: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateAmount = (amount: number | undefined) => {
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    throw new ServiceError("Amount must be a non-negative number", 400);
  }
};

const validateNotes = (notes: string | undefined) => {
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ServiceError("Notes must be text with no more than 2000 characters", 400);
  }
};

export const invoiceService = {
  async create(body: CreateInvoiceInput, user: AuthenticatedUser) {
    const { invoiceTitle, invoiceDescription, sendDate, client, notes, amount } = body;
    if (typeof invoiceTitle !== "string" || !invoiceTitle.trim() || typeof invoiceDescription !== "string" || !invoiceDescription.trim()) {
      throw new ServiceError("Invoice title and description are required", 400);
    }
    if (!mongoose.isValidObjectId(client)) throw new ServiceError("A valid client is required", 400);
    validateAmount(amount);
    validateNotes(notes);

    const clientExists = await Client.findOne({ _id: client, ...(await tenantDataScope({ user })) }).select("_id");
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

  async update(id: string, body: UpdateInvoiceInput, user: AuthenticatedUser) {
    const { invoiceTitle, invoiceDescription, sendDate, client, amount, notes } = body;
    if (client !== undefined && !mongoose.isValidObjectId(client)) throw new ServiceError("Invalid client id", 400);
    validateAmount(amount);
    validateNotes(notes);

    if (client !== undefined && !(await Client.exists({ _id: client, ...(await tenantDataScope({ user })) }))) {
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

  async getById(id: string, user: AuthenticatedUser) {
    const invoice = await Invoice.findOne({ _id: id, ...(await invoiceScope({ user })) }).populate("client");
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },

  async getAll(query: Partial<InvoiceListQuery>, user: AuthenticatedUser) {
    const { startDate, endDate, search: rawSearch = "" } = query;
    const filter: FilterQuery<InvoiceRecord> = { ...(await invoiceScope({ user })) };
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
    if (typeof rawSearch !== "string") throw new ServiceError("Invalid search", 400);
    const search = rawSearch.trim().slice(0, 100);
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      const matchingClients = await Client.find({
        ...(await tenantDataScope({ user })),
        $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
      }).select("_id").lean();
      filter.$or = [
        { invoiceTitle: regex }, { invoiceDescription: regex },
        { client: { $in: matchingClients.map((client) => client._id) } },
      ];
    }
    const page = parsePage(query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(query.limit, 25, 100);
    const [totalResult, invoices] = await Promise.all([
      Invoice.countDocuments(filter),
      Invoice.find(filter)
        .populate({ path: "client", select: "firstName lastName" })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return {
      invoices,
      paginationInfo: { totalResult, totalPages: Math.ceil(totalResult / limit), currentPage: page, pageSize: limit },
    };
  },

  async updateStatus(id: string, invoiceStatus: PaymentStatus, user: AuthenticatedUser) {
    if (!["Pending", "Done"].includes(invoiceStatus)) throw new ServiceError("Invalid invoice status", 400);
    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, ...(await invoiceScope({ user })) },
      { $set: { invoiceStatus } },
      { new: true, runValidators: true }
    );
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },

  async remove(id: string, user: AuthenticatedUser) {
    const invoice = await Invoice.findOneAndDelete({ _id: id, ...(await invoiceScope({ user })) });
    if (!invoice) throw new ServiceError("Invoice not found", 404);
    return invoice;
  },
};
