import mongoose from "mongoose";
const Schema = mongoose.Schema;

const adminSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        firstName: {
            type: String,
            required: false,
        },
        lastName: {
            type: String,
            required: false,
        },
        position: {
            type: String,
            required: false,
        },

    },
    {
        timestamps: true
    }
)

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;