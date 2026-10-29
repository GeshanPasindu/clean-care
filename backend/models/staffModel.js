import mongoose from "mongoose";
const Schema = mongoose.Schema;

const staffSchema = new Schema(
    {

        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        firstName: {
            type: String,
            required: false,
        },
        lastName: {
            type: String,
            required: false,
        },
        address: {
            type: String,
            required: false,
        },
        phoneNumber: {
            type: String,
            required: false,
        },
        position: {
            type: String,
            required: false,
        },
        dateOfBirth: {
            type: Date,
            required: false,
        },
        dateOfHire: {
            type: Date,
            required: false,
        },
        empContactName: {
            type: String,
            required: false,
        },
        empPhoneNumber: {
            type: String,
            required: false,
        },
        bankAcNo: {
            type: Number,
            required: false,
        },
        bankName: {
            type: String,
            required: false,
        },
        bankAcBranch: {
            type: String,
            required: false,
        },
        bankAcBranch: {
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
        workStatus:{
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

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
