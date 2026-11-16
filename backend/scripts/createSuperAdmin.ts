import { databaseUri } from "../config/environment.js";
import { errorMessage } from "../utils/errors.js";
import "dotenv/config";
import argon2 from "argon2";
import mongoose from "mongoose";
import validator from "validator";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import { promptHidden, promptLine } from "./cliAuthHelpers.js";

const passwordOptions: argon2.HashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(databaseUri());
  const role = await Role.findOne({ key: "superadmin", scope: "platform", isActive: true });
  if (!role) throw new Error("Access-control roles are missing. Run npm run auth:seed-access-control first.");
  if (await User.exists({ role: role._id })) {
    throw new Error("A platform administrator already exists. Use the local password reset command for account recovery.");
  }

  const userName = (await promptLine("Super Admin user name: ")).trim();
  const email = (await promptLine("Super Admin email: ")).trim().toLowerCase();
  const password = await promptHidden("New password (minimum 10 characters): ");
  if (!userName || userName.length > 120 || !validator.isEmail(email) || password.length < 10 || password.length > 128) {
    throw new Error("Enter a valid user name, email, and password between 10 and 128 characters");
  }
  if (await User.exists({ email })) throw new Error("An account with that email already exists");

  await User.create({
    userName,
    email,
    role: role._id,
    tenantId: null,
    status: "active",
    isDeleted: false,
    password: await argon2.hash(password, passwordOptions),
  });
  console.log("Platform administrator account created.");
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
