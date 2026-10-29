import { Box, Chip, Typography } from "@mui/material";
import { surfaceSx } from "../styles/uiStyles";

export const formatFieldLabel = (field) =>
  field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

const renderDefaultValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    return (
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {Object.entries(value).map(([nestedField, nestedValue]) => (
          <Typography key={nestedField} component="span" sx={{ color: "text.primary" }}>
            <Box component="span" sx={{ color: "text.secondary" }}>
              {formatFieldLabel(nestedField)}:{" "}
            </Box>
            {nestedValue || "—"}
          </Typography>
        ))}
      </Box>
    );
  }
  if (field.toLowerCase().includes("status")) {
    const isPositive = ["active", "completed", "done", "paid"].includes(String(value).toLowerCase());
    return <Chip size="small" color={isPositive ? "success" : "default"} label={value} />;
  }
  return String(value);
};

const DetailGrid = ({ data, exclude = [], labels = {}, renderValue }) => {
  const entries = Object.entries(data).filter(([field]) => !exclude.includes(field));

  return (
    <Box sx={{ ...surfaceSx, mt: 2.5, overflow: "hidden" }}>
      {entries.map(([field, value], index) => (
        <Box
          key={field}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(170px, 28%) minmax(0, 1fr)" },
            gap: { xs: 0.5, sm: 3 },
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: index === entries.length - 1 ? 0 : "1px solid",
            borderColor: "divider",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Typography sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.875rem" }}>
            {labels[field] || formatFieldLabel(field)}
          </Typography>
          <Box sx={{ color: "text.primary", minWidth: 0, overflowWrap: "anywhere" }}>
            {renderValue ? renderValue(field, value, renderDefaultValue) : renderDefaultValue(field, value)}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default DetailGrid;
