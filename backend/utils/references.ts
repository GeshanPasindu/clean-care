import type { IdReference } from "../types/domain.js";

export const referenceId = (value: IdReference | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return String(
    typeof value === "object" && "_id" in value ? value._id : value,
  );
};

export const asList = <T>(value: T | T[] | null | undefined): T[] =>
  Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
