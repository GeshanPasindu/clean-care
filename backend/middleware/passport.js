import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import argon2 from "argon2";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import User from "../models/userModel.js";
import RefreshSession from "../models/refreshSessionModel.js";

const issuer = "cleancare-api";
const audience = "cleancare-frontend";
const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const dummyHash = argon2.hash(randomBytes(32).toString("hex"), passwordHashOptions);

export const getAccessTokenSecret = () => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET (or legacy SECRET) must contain at least 32 characters");
  }
  return secret;
};

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
      const upgradedHash = await argon2.hash(suppliedPassword, passwordHashOptions);
      await User.updateOne(
        { _id: user._id, password: storedHash },
        { $set: { password: upgradedHash } }
      );
      user.password = upgradedHash;
    }
  }

  return valid;
}

passport.use(
  "local",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password", session: false },
    async (email, password, done) => {
      try {
        if (typeof email !== "string" || typeof password !== "string" || password.length > 256) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail }).select("+password");
        if (!user || user.status !== "active") {
          if (!user) await verifyPasswordAndUpgrade(null, password);
          return done(null, false, { message: "Invalid email or password" });
        }

        const valid = await verifyPasswordAndUpgrade(user, password);
        if (!valid) return done(null, false, { message: "Invalid email or password" });
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  "jwt",
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getAccessTokenSecret(),
      issuer,
      audience,
      algorithms: ["HS256"],
      passReqToCallback: false,
    },
    async (payload, done) => {
      try {
        if (!payload.sub || !payload.sid) return done(null, false);
        const [user, session] = await Promise.all([
          User.findById(payload.sub).select("_id userName email role status adminDetails staffDetails superAdminDetails"),
          RefreshSession.findOne({
            _id: payload.sid,
            user: payload.sub,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          }).select("_id user familyId"),
        ]);

        if (!user || user.status !== "active" || !session) return done(null, false);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

export default passport;
