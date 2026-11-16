import { accessTokenPayloadSchema } from "../validation/auth.js";
import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { authService } from "../services/authService.js";
import { getAccessTokenSecret } from "../services/tokenService.js";
export { getAccessTokenSecret } from "../services/tokenService.js";

const issuer = "cleancare-api";
const audience = "cleancare-frontend";
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
    async (payload: unknown, done) => {
      try {
        const parsed = accessTokenPayloadSchema.safeParse(payload);
        if (!parsed.success) return done(null, false);
        const user = await authService.authenticateAccess(parsed.data);
        return done(null, user || false);
      } catch (error) {
        return done(error);
      }
    }
  )
);

export default passport;
