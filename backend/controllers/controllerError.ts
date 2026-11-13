import { errorMessage } from "../utils/errors.js";
import { ServiceError } from "../services/serviceError.js";
import type { HttpResponse } from "../types/http.js";

export function sendServiceError(
  res: HttpResponse,
  error: unknown,
  fallbackStatusCode = 400,
) {
  if (error instanceof ServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(fallbackStatusCode).json({
    response_code: fallbackStatusCode,
    success: false,
    error: errorMessage(error),
  });
}
