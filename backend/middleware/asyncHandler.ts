import type { RequestHandler } from "express";
import type { HttpHandler } from "../types/http.js";

export const asyncHandler = (handler: HttpHandler): RequestHandler => (req, res, next) => {
  void Promise.resolve().then(() => handler(req, res, next)).catch(next);
};
