import { Box } from "@mui/material";
import documentLogo from "../assets/logo/document-logo.jpg";

export default function DocumentLogo() {
  return (
    <Box
      sx={{
        width: { xs: 144, sm: 176 },
        maxWidth: "100%",
        aspectRatio: "11 / 6",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: "#fff",
      }}
    >
      <Box
        component="img"
        src={documentLogo}
        alt="Business logo"
        sx={{
          // Frame the artwork inside the supplied image's wide white margins.
          position: "absolute",
          display: "block",
          width: "136.363636%",
          maxWidth: "none",
          height: "auto",
          left: "-18.181818%",
          top: "-72.222222%",
        }}
      />
    </Box>
  );
}
