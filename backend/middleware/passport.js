import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { authService } from "../services/authService.js";
import { getAccessTokenSecret } from "../services/tokenService.js";
export { getAccessTokenSecret } from "../services/tokenService.js";

const issuer = "cleancare-api";
const audience = "cleancare-frontend";
passport.use(
  "local",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password", session: false },
    async (email, password, done) => {
      try {
        const user = await authService.authenticateLocal(email, password);
        return done(null, user || false, user ? undefined : { message: "Invalid email or password" });
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
        const user = await authService.authenticateAccess(payload);
        return done(null, user || false);
      } catch (error) {
        return done(error);
      }
    }
  )
);

export default passport;
