import { Box, Typography } from "@mui/material";

const Header = ({ title, subtitle }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="h2"
      color="text.primary"
      sx={{ mb: subtitle ? 0.5 : 0, lineHeight: 1.2 }}
    >
      {title}
    </Typography>
    {subtitle ? (
      <Typography variant="body1" color="text.secondary">
        {subtitle}
      </Typography>
    ) : null}
  </Box>
);

export default Header;
