import mongoose from "mongoose";
const Schema = mongoose.Schema;

const invoiceSchema = new Schema(
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
        invoiceStatus:{
            type: String,
            enum: ['Pending', 'Done'],
            default: 'Pending',
            required: true,
        },
     
    },
    {
        timestamps: true
    }
)

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;