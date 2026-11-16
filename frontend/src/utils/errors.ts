export const errorMessage = (
  error: unknown,
  fallback = "The request failed",
): string => (error instanceof Error ? error.message : fallback);
