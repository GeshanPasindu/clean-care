import argon2 from "argon2";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import User from "../models/userModel.js";

const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const dummyHash = argon2.hash(randomBytes(32).toString("hex"), passwordHashOptions);

export const hashPassword = (password) => argon2.hash(password, passwordHashOptions);

export async function verifyPasswordAndUpgrade(user, suppliedPassword) {
  const storedHash = user?.password;
  if (!storedHash) {
    await argon2.verify(await dummyHash, String(suppliedPassword)).catch(() => false);
    return false;
  }

  let valid = false;
  if (storedHash.startsWith("$argon2")) {
    valid = await argon2.verify(storedHash, suppliedPassword).catch(() => false);
  } else if (/^\$2[aby]\$/.test(storedHash)) {
    valid = await bcrypt.compare(suppliedPassword, storedHash).catch(() => false);
    if (valid) {
      const upgradedHash = await hashPassword(suppliedPassword);
      await User.updateOne(
        { _id: user._id, password: storedHash },
        { $set: { password: upgradedHash } }
      );
      user.password = upgradedHash;
    }
  }

  return valid;
}
