import "dotenv/config";
import mongoose from "mongoose";
import { ensureSingleSuperAdminIndex } from "./singleSuperAdminIndex.js";

try {
  await mongoose.connect(process.env.MONGO_URI);
  await ensureSingleSuperAdminIndex();
  console.log("Single-superAdmin database constraint is ready.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
