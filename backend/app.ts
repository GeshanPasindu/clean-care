import { errorHandler } from "./middleware/errorHandler.js";
import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "./middleware/passport.js";
import { allowedOrigins } from "./config/security.js";
import { rejectMongoOperators } from "./middleware/requestSecurity.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import authRoutes from "./routes/authRoute.js";
import clientRoutes from "./routes/clientRoute.js";
import jobRoutes from "./routes/jobRoute.js";
import userRoutes from "./routes/userRoute.js";
import invoiceRoutes from "./routes/invoiceRoute.js";
import roleRoutes from "./routes/roleRoute.js";
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use("/api", apiLimiter);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.json({ limit: "10mb", strict: true }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(rejectMongoOperators);
mongoose.set("strictQuery", true);

app.use("/api/auth", authRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/roles", roleRoutes);

app.use(errorHandler);

export default app;
