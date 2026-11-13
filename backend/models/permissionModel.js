import mongoose from "mongoose";

const { Schema } = mongoose;

const permissionSchema = new Schema({
  key: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  group: { type: String, required: true, trim: true, maxlength: 80 },
  isSystem: { type: Boolean, default: true, required: true },
  platformOnly: { type: Boolean, default: false, required: true },
}, { timestamps: true });

export default mongoose.model("Permission", permissionSchema);
