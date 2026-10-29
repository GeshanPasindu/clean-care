import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { Box, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useState } from "react";
import { Menu, MenuItem, ProSidebar } from "react-pro-sidebar";
import "react-pro-sidebar/dist/css/styles.css";
import { Link, useLocation } from "react-router-dom";
import Brand from "../../components/Brand";
import { useAuth } from "../../auth/AuthContext";

const NavItem = ({ title, to, icon, isActive, onNavigate }) => (
  <MenuItem active={isActive} icon={icon} onClick={onNavigate}>
    <Typography component="span" sx={{ fontSize: "0.9rem", fontWeight: 550 }}>
      {title}
    </Typography>
    <Link to={to} aria-label={title} />
  </MenuItem>
);

const Sidebar = ({ isSidebar, setIsSidebar }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const userRole = user?.role;

  const showManagement = userRole !== "staff";
  const showSuperAdmin = userRole === "superAdmin";
  const handleNavigate = () => {
    if (isMobile) setIsSidebar(false);
  };
  const matches = (path, includeChildren = false) =>
    includeChildren
      ? location.pathname.toLowerCase().startsWith(path.toLowerCase())
      : location.pathname.toLowerCase() === path.toLowerCase();

  return (
    <Box
      component="aside"
      sx={{
        flexShrink: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
        "& .pro-sidebar": {
          height: "100vh",
          position: { xs: "fixed", md: "sticky" },
          top: 0,
          boxShadow: "12px 0 30px rgba(15, 23, 42, 0.08)",
        },
        "& .pro-sidebar-inner": {
          background: "#0f172a !important",
        },
        "& .pro-sidebar-layout": {
          scrollbarWidth: "none",
        },
        "& .pro-icon-wrapper": {
          color: "#94a3b8",
          backgroundColor: "transparent !important",
        },
        "& .pro-inner-item": {
          margin: "4px 12px",
          padding: "11px 14px !important",
          borderRadius: "10px",
          color: "#cbd5e1",
          transition: "all 160ms ease",
        },
        "& .pro-inner-item:hover": {
          color: "#ffffff !important",
          backgroundColor: "rgba(255, 255, 255, 0.07)",
        },
        "& .pro-menu-item.active .pro-inner-item": {
          color: "#ffffff !important",
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          boxShadow: "0 8px 18px rgba(79, 70, 229, 0.24)",
        },
        "& .pro-menu-item.active .pro-icon-wrapper": {
          color: "#ffffff",
        },
        "& .pro-sidebar.collapsed .pro-inner-item": {
          marginInline: "10px",
          paddingInline: "14px !important",
        },
      }}
    >
      <ProSidebar
        collapsed={!isMobile && isCollapsed}
        breakPoint="md"
        toggled={isSidebar}
        onToggle={setIsSidebar}
        width="264px"
      >
        <Box
          sx={{
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed && !isMobile ? "center" : "space-between",
            px: isCollapsed && !isMobile ? 1.5 : 2.5,
            borderBottom: "1px solid rgba(148, 163, 184, 0.13)",
          }}
        >
          {isCollapsed && !isMobile ? (
            <IconButton
              onClick={() => setIsCollapsed(false)}
              aria-label="Expand navigation"
              sx={{ p: 0, "&:hover": { backgroundColor: "transparent" } }}
            >
              <Brand compact inverse />
            </IconButton>
          ) : (
            <>
              <Brand inverse />
              <IconButton
                onClick={() => setIsCollapsed(true)}
                aria-label="Collapse navigation"
                sx={{ color: "#94a3b8", display: { xs: "none", md: "inline-flex" } }}
              >
                <MenuRoundedIcon />
              </IconButton>
            </>
          )}
        </Box>

        <Menu iconShape="square">
          {(!isCollapsed || isMobile) && (
            <Typography
              variant="overline"
              sx={{ display: "block", color: "#64748b", px: 3.25, pt: 3, pb: 0.75, letterSpacing: "0.12em" }}
            >
              Workspace
            </Typography>
          )}

          {showManagement && (
            <NavItem
              title="Dashboard"
              to="/dashboard"
              icon={<DashboardOutlinedIcon />}
              isActive={matches("/dashboard")}
              onNavigate={handleNavigate}
            />
          )}
          <NavItem
            title="Jobs"
            to="/jobs"
            icon={<BusinessCenterOutlinedIcon />}
            isActive={matches("/jobs", true) && !matches("/jobs/paymentSummery")}
            onNavigate={handleNavigate}
          />
          {showManagement && (
            <>
              <NavItem
                title="Completed Jobs"
                to="/completedjobs"
                icon={<CheckCircleOutlineRoundedIcon />}
                isActive={matches("/completedjobs")}
                onNavigate={handleNavigate}
              />
              <NavItem
                title="Payment Summary"
                to="/paymentsummery"
                icon={<PaymentsOutlinedIcon />}
                isActive={matches("/paymentsummery")}
                onNavigate={handleNavigate}
              />
              <NavItem
                title="Clients"
                to="/clients"
                icon={<ContactsOutlinedIcon />}
                isActive={matches("/clients", true)}
                onNavigate={handleNavigate}
              />
              <NavItem
                title="Invoices"
                to="/invoices"
                icon={<ReceiptLongOutlinedIcon />}
                isActive={matches("/invoices", true)}
                onNavigate={handleNavigate}
              />
              <NavItem
                title="Staff"
                to="/staff"
                icon={<GroupOutlinedIcon />}
                isActive={matches("/staff", true)}
                onNavigate={handleNavigate}
              />
            </>
          )}
          <NavItem
            title="Timesheets"
            to="/timesheets"
            icon={<AccessTimeOutlinedIcon />}
            isActive={matches("/timesheets", true)}
            onNavigate={handleNavigate}
          />
          {userRole === "staff" && (
            <NavItem
              title="My Payments"
              to="/my-payments"
              icon={<PaymentsOutlinedIcon />}
              isActive={matches("/my-payments")}
              onNavigate={handleNavigate}
            />
          )}
          {showSuperAdmin && (
            <NavItem
              title="Administrators"
              to="/admin"
              icon={<AdminPanelSettingsOutlinedIcon />}
              isActive={matches("/admin", true)}
              onNavigate={handleNavigate}
            />
          )}
        </Menu>
      </ProSidebar>
    </Box>
  );
};

export default Sidebar;
