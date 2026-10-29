import "dotenv/config";
import argon2 from "argon2";
import mongoose from "mongoose";
import validator from "validator";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import User from "../models/userModel.js";
import { promptHidden, promptLine } from "./cliAuthHelpers.js";

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

try {
  await mongoose.connect(process.env.MONGO_URI);
  const email = (process.argv[2] || await promptLine("Account email: ")).toLowerCase();
  const password = await promptHidden("New password (minimum 10 characters): ");
  if (!validator.isEmail(email) || password.length < 10 || password.length > 128) {
    throw new Error("Enter a valid email and a password between 10 and 128 characters");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new Error("No account found for that email");
  user.password = await argon2.hash(password, passwordOptions);
  await user.save();

  const now = new Date();
  const sessions = await RefreshSession.find({ user: user._id, revokedAt: null }).select("familyId");
  const familyIds = sessions.map((session) => session.familyId);
  await Promise.all([
    RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: now } }),
    familyIds.length
      ? RefreshToken.updateMany({ familyId: { $in: familyIds }, consumedAt: null }, { $set: { consumedAt: now } })
      : Promise.resolve(),
  ]);
  console.log("Password updated; existing sessions were revoked.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
