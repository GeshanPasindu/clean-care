import type { RequestHandler } from "express";
import { z } from "zod";
import type {
  AuthenticatedUser,
  ServiceContext,
  ServiceResult,
} from "../types/domain.js";
import type {
  HttpHandler,
  HttpRequest,
  HttpResponse,
  RequestParts,
} from "../types/http.js";
import { ServiceError } from "../services/serviceError.js";
import { asyncHandler } from "./asyncHandler.js";

export function authenticatedUser(request: HttpRequest): AuthenticatedUser {
  if (!request.user) throw new ServiceError("Authentication required", 401);
  return request.user;
}

export function validatedController<S extends z.ZodType<RequestParts>>(
  schema: S,
  handler: (
    input: z.output<S>,
    user: AuthenticatedUser,
    request: HttpRequest,
    response: HttpResponse,
  ) => unknown | Promise<unknown>,
): RequestHandler {
  const controller: HttpHandler = (request, response) => {
    const input = schema.parse({
      body: request.body,
      params: request.params,
      query: request.query,
    });
    return handler(input, authenticatedUser(request), request, response);
  };
  return asyncHandler(controller);
}

export function validatedService<B, P, Q>(
  schema: z.ZodType<{ body: B; params: P; query: Q }>,
  service: (context: ServiceContext<B, P, Q>) => Promise<ServiceResult>,
): RequestHandler {
  return validatedController(
    schema,
    async (input, user, _request, response) => {
      const result = await service({ ...input, user });
      return response.status(result.statusCode).json(result.body);
    },
  );
}
