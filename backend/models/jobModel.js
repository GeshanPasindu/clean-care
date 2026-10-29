import mongoose from "mongoose";
const Schema = mongoose.Schema;

const staffTimeEntrySchema = new Schema({
    signInTime: Date,
    signOffTime: Date,
    hours: {
        type: Number,
        default: 0,
        min: 0,
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
