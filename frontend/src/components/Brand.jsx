import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import { Box, Typography } from "@mui/material";

const Brand = ({ compact = false, inverse = false }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
    <Box
      sx={{
        width: 40,
        height: 40,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        color: "#ffffff",
        borderRadius: 2.5,
        background: "linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)",
        boxShadow: "0 8px 18px rgba(14, 165, 233, 0.24)",
      }}
    >
      <CleaningServicesRoundedIcon sx={{ fontSize: 23 }} />
    </Box>
    {!compact && (
      <Typography
        component="span"
        sx={{
          color: inverse ? "#ffffff" : "text.primary",
          fontSize: "1.25rem",
          fontWeight: 750,
          letterSpacing: "-0.035em",
          whiteSpace: "nowrap",
        }}
      >
        Clean
        <Box component="span" sx={{ color: inverse ? "#7dd3fc" : "primary.main" }}>
          Care
        </Box>
      </Typography>
    )}
  </Box>
);

export default Brand;
