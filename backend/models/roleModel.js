import mongoose from "mongoose";

const { Schema } = mongoose;

const roleSchema = new Schema({
  key: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  scope: { type: String, enum: ["platform", "tenant", "staff"], required: true, default: "tenant" },
  isSystem: { type: Boolean, default: false, required: true },
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true });

roleSchema.index({ isActive: 1, scope: 1 });

export default mongoose.model("Role", roleSchema);
