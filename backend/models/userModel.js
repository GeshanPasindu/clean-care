import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        userName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        password: {
            type: String,
            required: true,
            select: false,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
        },
        role: {
            type: String,
            enum: ['admin', 'staff','superAdmin'],
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            required: true,
            default: 'active'
        },
        adminDetails: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
        },
        staffDetails: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
        },
        superAdminDetails: {
            type: Schema.Types.ObjectId,
            ref: 'SuperAdmin',
        },
       
    },
    {
        timestamps: true
    }
);

userSchema.index(
    { role: 1 },
    {
        name: "single_superadmin_account",
        unique: true,
        partialFilterExpression: { role: "superAdmin" },
    }
);

const User = mongoose.model("User", userSchema);
export default User;
