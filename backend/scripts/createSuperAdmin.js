import "dotenv/config";
import argon2 from "argon2";
import mongoose from "mongoose";
import validator from "validator";
import Admin from "../models/adminModel.js";
import SuperAdmin from "../models/superAdminModel.js";
import User from "../models/userModel.js";
import { promptHidden, promptLine } from "./cliAuthHelpers.js";
import { ensureSingleSuperAdminIndex } from "./singleSuperAdminIndex.js";

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

let createdUser;

try {
  await mongoose.connect(process.env.MONGO_URI);
  await ensureSingleSuperAdminIndex();
  if (await User.exists({ role: "superAdmin" })) {
    throw new Error("A superAdmin already exists. Use the local password reset command for account recovery.");
  }

  const userName = await promptLine("SuperAdmin user name: ");
  const email = (await promptLine("SuperAdmin email: ")).toLowerCase();
  const password = await promptHidden("New password (minimum 10 characters): ");
  if (!userName || userName.length > 120 || !validator.isEmail(email) || password.length < 10 || password.length > 128) {
    throw new Error("Enter a valid user name, email, and password between 10 and 128 characters");
  }
  if (await User.exists({ email })) throw new Error("An account with that email already exists");

  createdUser = await User.create({ userName, email, role: "superAdmin", password: await argon2.hash(password, passwordOptions) });
  const [adminProfile, superAdminProfile] = await Promise.all([
    Admin.create({ user: createdUser._id }),
    SuperAdmin.create({ user: createdUser._id }),
  ]);
  createdUser.adminDetails = adminProfile._id;
  createdUser.superAdminDetails = superAdminProfile._id;
  await createdUser.save();
  console.log("SuperAdmin account created.");
} catch (error) {
  if (createdUser) {
    await Promise.allSettled([
      Admin.deleteOne({ user: createdUser._id }),
      SuperAdmin.deleteOne({ user: createdUser._id }),
      User.deleteOne({ _id: createdUser._id }),
    ]);
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
