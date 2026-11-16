import { z } from "zod";
export const databaseUri = (): string =>
  z.string().min(1, "MONGO_URI is required").parse(process.env.MONGO_URI);
export const serverPort = (): number =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000)
    .parse(process.env.PORT);
