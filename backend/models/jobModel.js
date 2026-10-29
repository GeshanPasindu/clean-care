import mongoose from "mongoose";
const Schema = mongoose.Schema;

const staffTimeEntrySchema = new Schema({
    signInTime: Date,
    signOffTime: Date,
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
    },
    hours: {
        type: Number,
        default: 0,
        min: 0,
    },
    hourRate: {
        type: Number,
        min: 0,
    },
    payoutAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    payoutReceiptCredit: {
        type: Number,
        default: 0,
        min: 0,
    },
    payoutBatchId: {
        type: Schema.Types.ObjectId,
        ref: 'StaffPayroll',
        default: null,
    },
}, { _id: false });

const staffAssignmentSchema = new Schema({
    staff: {
        type: Schema.Types.ObjectId,
        ref: 'Staff',
        required: true,
    },
    isAssigned: {
        type: Boolean,
        default: true,
    },
    estimatedHours: {
        type: Number,
        default: 0,
        min: 0,
    },
    hourRate: {
        type: Number,
        default: 0,
        min: 0,
    },
    estimatedPayment: {
        type: Number,
        default: 0,
        min: 0,
    },
    hours: {
        type: Number,
        default: 0,
        min: 0,
    },
    payment: {
        type: Number,
        default: 0,
        min: 0,
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Done'],
        default: 'Pending',
        required: true,
    },
    payoutReceipts: {
        type: [{
            amount: { type: Number, required: true, min: 0.01 },
            paymentDate: { type: Date, required: true },
            method: { type: String, enum: ['Cash', 'Bank Transfer', 'Card', 'Cheque', 'Other'], required: true },
            referenceNumber: { type: String, trim: true, maxlength: 120, default: '' },
            recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            payeeName: { type: String, trim: true, maxlength: 160, default: '' },
            payeeEmail: { type: String, trim: true, maxlength: 254, default: '' },
            payeePhoneNumber: { type: String, trim: true, maxlength: 40, default: '' },
            jobName: { type: String, trim: true, maxlength: 160, default: '' },
            jobDate: { type: Date },
            hours: { type: Number, min: 0, default: 0 },
            hourRate: { type: Number, min: 0, default: 0 },
        }],
        default: [],
    },
    signInTime: Date,
    signOffTime: Date,
    timeEntries: {
        type: [staffTimeEntrySchema],
        default: [],
    },
    isSignIn: {
        type: Boolean,
        default: false,
    },
    isSignOff: {
        type: Boolean,
        default: false,
    },
}, { _id: false });

const receivedPaymentSchema = new Schema({
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true },
    method: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'Card', 'Cheque', 'Other'],
        required: true,
    },
    referenceNumber: { type: String, trim: true, maxlength: 120, default: '' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientName: { type: String, trim: true, maxlength: 160, default: '' },
    clientEmail: { type: String, trim: true, maxlength: 254, default: '' },
    clientPhoneNumber: { type: String, trim: true, maxlength: 40, default: '' },
    clientAddress: { type: String, trim: true, maxlength: 500, default: '' },
    jobName: { type: String, trim: true, maxlength: 160, default: '' },
}, { timestamps: true });

const jobSchema = new Schema(
    {

        jobName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        client: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },
        assignedStaff: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'Staff',
            }],
            required: true,
            validate: {
                validator: (staffIds) => Array.isArray(staffIds) && staffIds.length > 0,
                message: 'At least one staff member must be assigned to a job',
            },
        },
        staffAssignments: {
            type: [staffAssignmentSchema],
            default: [],
        },
        receivedPayments: {
            type: [receivedPaymentSchema],
            default: [],
        },
        orgNoOfhours: {
            type: Number,
            required: false,
        },
        orgHourRate: {
            type: Number,
            required: false,
        },
        orgTotal: {
            type: Number,
            required: false,
        },
        estNoOfhours: {
            type: Number,
            required: false,
        },
        staffHourRate: {
            type: Number,
            required: false,
        },
        staffPayTotal: {
            type: Number,
            required: false,
        },
        staffHoursTotal: {
            type: Number,
            required: false,
            default: 0,
        },
        staffPaymentTotal: {
            type: Number,
            required: false,
            default: 0,
        },
        noOfhours: {
            type: Number,
            required: false,
        },
        hourRate: {
            type: Number,
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
        payment: {
            type: Number,
            required: false,
        },
        paymentStatus:{
            type: String,
            enum: ['Pending', 'Done'],
            default: 'Pending',
            required: true,
        },
        jobStatus:{
            type: String,
            enum: ['InProgress', 'Completed','Cancelled'],
            default: 'InProgress',
            required: true,
        },
        jobDate: {
            type: Date,
            required: false,
        },
        signInTime: {
            type: Date,
            required: false,
        },
        signOffTime: {
            type: Date,
            required: false,
        },
        isSignOff:{
            type:Boolean,
            required:false,
            default:false
        },
        isSignIn:{
            type:Boolean,
            required:false,
            default:false
        }
        
     
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    }
)

const Job = mongoose.model('Job', jobSchema);

export default Job;
