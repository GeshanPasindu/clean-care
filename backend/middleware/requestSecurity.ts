import mongoose from "mongoose";
import type { HttpHandler } from "../types/http.js";

function containsMongoOperator(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMongoOperator);
  if (!value || typeof value !== "object" || value instanceof Date) return false;

  return Object.entries(value).some(([key, child]: [string, unknown]) =>
    key.startsWith("$") || key.includes(".") || containsMongoOperator(child)
  );
}

export const rejectMongoOperators: HttpHandler = (req, res, next) => {
  if (containsMongoOperator(req.body) || containsMongoOperator(req.query)) {
    return res.status(400).json({ message: "Invalid request fields" });
  }
  return next();
};

export const requireObjectId = (parameterName: string): HttpHandler => (req, res, next) => {
  const value = req.params[parameterName];
  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({ message: `Invalid ${parameterName}` });
  }
  return next();
};
