import { accountStatuses } from "../types/domain.js";
import type { ClientRecord } from "../types/models.js";
import mongoose from "mongoose";
const Schema = mongoose.Schema;

const clientSchema = new Schema<ClientRecord>(
    {

        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        address: {
            type: String,
            required: true,
        },
        phoneNumber: {
            type: String,
            required: true,
        },
        contactName: {
            type: String,
            required: false,
        },
        contactPhoneNumber: {
            type: String,
            required: false,
        },
        contactEmail: {
            type: String,
            required: false,
        },
        accountManager: {
            type: String,
            required: false,
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        notes: {
            type: String,
            required: false,
        },
        clientStatus:{
            type: String,
            enum: [...accountStatuses],
            default: 'active',
            required: true,
        },
     
    },
    {
        timestamps: true
    }
)

const Client = mongoose.model<ClientRecord>("Client", clientSchema);

export default Client;
