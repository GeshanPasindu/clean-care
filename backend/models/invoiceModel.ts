import { paymentStatuses } from "../types/domain.js";
import type { InvoiceRecord } from "../types/models.js";
import mongoose from "mongoose";
const Schema = mongoose.Schema;

const invoiceSchema = new Schema<InvoiceRecord>(
    {

        invoiceTitle: {
            type: String,
            required: true,
        },
        invoiceDescription: {
            type: String,
            required: true,
        },
        sendDate: {
            type: Date,
            required: false,
        },
        client: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },
        amount: {
            type: Number,
            required: false,
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 2000,
            required: false,
        },
        invoiceStatus:{
            type: String,
            enum: [...paymentStatuses],
            default: 'Pending',
            required: true,
        },
     
    },
    {
        timestamps: true
    }
)

const Invoice = mongoose.model<InvoiceRecord>("Invoice", invoiceSchema);

export default Invoice;
