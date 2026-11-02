import { ServiceError } from "../services/serviceError.js";

export function sendServiceError(res, error, fallbackStatusCode = 400) {
  if (error instanceof ServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(fallbackStatusCode).json({
    response_code: fallbackStatusCode,
    success: false,
    error: error.message,
  });
}
