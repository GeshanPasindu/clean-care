import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { errorMessage, errorStatus } from "../utils/errors.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) return next(error);
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Request validation failed",
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }
  const status = errorStatus(error) || 500;
  if (status >= 500) console.error("Request failed:", errorMessage(error));
  return response
    .status(status)
    .json({
      message: status >= 500 ? "Internal server error" : errorMessage(error),
    });
};
