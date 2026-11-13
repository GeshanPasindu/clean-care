import type { NextFunction, Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export type HttpRequest = Request<ParamsDictionary, unknown, unknown, ParsedQs>;
export type HttpResponse = Response<unknown>;
export type HttpHandler = (
  request: HttpRequest,
  response: HttpResponse,
  next: NextFunction,
) => unknown | Promise<unknown>;
export interface RequestParts {
  body: unknown;
  params: unknown;
  query: unknown;
}
