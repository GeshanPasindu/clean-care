import mongoose from "mongoose";
const Schema = mongoose.Schema;

const superAdminSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true
    }
);

const SystemAdmin = mongoose.model("SuperAdmin", superAdminSchema);


export default SystemAdmin;