import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { Avatar, Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import profile from "../../assets/logo/profile.png";
import { useAuth } from "../../auth/AuthContext";
import { ColorModeContext } from "../../theme";

const formatRole = (role = "") =>
  role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());

const Topbar = ({ setIsSidebar }) => {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const adminData = {
    userName: user?.userName || "Account",
    image: profile,
    role: user?.role || "",
  };
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    setAnchorEl(null);
    Swal.fire({
      title: "Sign out?",
      text: "You will need to sign in again to access your workspace.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#667085",
      confirmButtonText: "Sign out",
    }).then((result) => {
      if (result.isConfirmed) {
        logout().catch(() => {}).finally(() => navigate("/", { replace: true }));
      }
    });
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.appBar,
        height: 72,
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        px: { xs: 1.5, sm: 2.5, lg: 3.5 },
        backgroundColor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton
          onClick={() => setIsSidebar((value) => !value)}
          aria-label="Open navigation"
          sx={{ display: { xs: "inline-flex", md: "none" } }}
        >
          <MenuRoundedIcon />
        </IconButton>
        <Box>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.2 }}>
            CleanCare
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: "text.primary" }}>
            Operations workspace
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 } }}>
        <IconButton onClick={colorMode.toggleColorMode} aria-label="Toggle color mode">
          {theme.palette.mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>

        <Button
          color="inherit"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-haspopup="true"
          aria-expanded={Boolean(anchorEl)}
          sx={{
            minHeight: 48,
            px: { xs: 0.5, sm: 1 },
            color: "text.primary",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Avatar src={adminData.image} alt={adminData.userName} sx={{ width: 38, height: 38 }} />
          <Box sx={{ display: { xs: "none", sm: "block" }, ml: 1.25, textAlign: "left" }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 650, lineHeight: 1.25 }}>
              {adminData.userName || "Account"}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.25 }}>
              {formatRole(adminData.role)}
            </Typography>
          </Box>
          <KeyboardArrowDownRoundedIcon sx={{ ml: 0.5, color: "text.secondary" }} />
        </Button>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem component={Link} to="/profile" onClick={() => setAnchorEl(null)}>
            <AccountCircleOutlinedIcon sx={{ mr: 1.25, color: "text.secondary" }} />
            My profile
          </MenuItem>
          <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
            <LogoutRoundedIcon sx={{ mr: 1.25 }} />
            Sign out
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default Topbar;
