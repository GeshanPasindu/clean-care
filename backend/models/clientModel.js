import mongoose from "mongoose";
const Schema = mongoose.Schema;

const clientSchema = new Schema(
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
        adminId: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
        },
        notes: {
            type: String,
            required: false,
        },
        clientStatus:{
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            required: true,
        },
     
    },
    {
        timestamps: true
    }
)

const Client = mongoose.model('Client', clientSchema);

export default Client;