import mongoose from "mongoose";

function containsMongoOperator(value) {
  if (Array.isArray(value)) return value.some(containsMongoOperator);
  if (!value || typeof value !== "object" || value instanceof Date) return false;

  return Object.entries(value).some(([key, child]) =>
    key.startsWith("$") || key.includes(".") || containsMongoOperator(child)
  );
}

export function rejectMongoOperators(req, res, next) {
  if (containsMongoOperator(req.body) || containsMongoOperator(req.query)) {
    return res.status(400).json({ message: "Invalid request fields" });
  }
  return next();
}

export const requireObjectId = (parameterName) => (req, res, next) => {
  const value = req.params[parameterName];
  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({ message: `Invalid ${parameterName}` });
  }
  return next();
};
