import type { EntityId } from "../types/domain.js";
import { databaseUri } from "../config/environment.js";
import { errorMessage } from "../utils/errors.js";
import "dotenv/config";
import mongoose from "mongoose";
import Job from "../models/jobModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import User from "../models/userModel.js";

const retentionDays = Number(process.env.USER_DELETION_RETENTION_DAYS);

async function revokeSessions(userId: EntityId) {
  const sessions = await RefreshSession.find({ user: userId }).select("familyId").lean();
  const familyIds = sessions.map((session) => session.familyId);
  await Promise.all([
    RefreshSession.deleteMany({ user: userId }),
    familyIds.length ? RefreshToken.deleteMany({ familyId: { $in: familyIds } }) : Promise.resolve(),
  ]);
}

try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("Set USER_DELETION_RETENTION_DAYS to a whole number between 1 and 3650");
  }
  await mongoose.connect(databaseUri());

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expiredUsers = await User.find({ isDeleted: true, deletedAt: { $lte: cutoff } }).select("_id").lean();
  let purged = 0;

  for (const user of expiredUsers) {
    await Promise.all([
      StaffPayroll.updateMany({ staff: user._id }, {
        $set: { payeeName: "Former user", payeeEmail: "", payeePhoneNumber: "" },
      }),
      Job.updateMany({ "staffAssignments.staff": user._id }, {
        $set: {
          "staffAssignments.$[assignment].payoutReceipts.$[].payeeName": "Former user",
          "staffAssignments.$[assignment].payoutReceipts.$[].payeeEmail": "",
          "staffAssignments.$[assignment].payoutReceipts.$[].payeePhoneNumber": "",
        },
      }, { arrayFilters: [{ "assignment.staff": user._id }] }),
    ]);
    await revokeSessions(user._id);
    await User.deleteOne({ _id: user._id, isDeleted: true, deletedAt: { $lte: cutoff } });
    purged += 1;
  }

  console.log(`Purged ${purged} deleted user account(s) older than ${retentionDays} days.`);
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
