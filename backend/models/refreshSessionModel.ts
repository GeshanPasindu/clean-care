import type { RefreshSessionRecord } from "../types/models.js";
import mongoose from "mongoose";

const refreshSessionSchema = new mongoose.Schema<RefreshSessionRecord>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 512 },
    ipAddress: { type: String, maxlength: 64 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<RefreshSessionRecord>("RefreshSession", refreshSessionSchema);
