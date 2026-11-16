export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unexpected error";
export const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : "Error";
export function errorCode(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
    ? error.code
    : undefined;
}
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("statusCode" in error && typeof error.statusCode === "number")
    return error.statusCode;
  if ("status" in error && typeof error.status === "number")
    return error.status;
  return undefined;
}
