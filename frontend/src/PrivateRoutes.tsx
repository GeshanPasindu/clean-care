import { Box, CircularProgress } from "@mui/material";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

const PrivateRoute = ({
  children,
  permission,
  anyPermissions,
}: {
  children: ReactNode;
  permission?: string | string[];
  anyPermissions?: string[];
}) => {
  const { user, status, hasPermission } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (status !== "authenticated" || !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  const requiredPermissions = Array.isArray(permission)
    ? permission
    : permission
      ? [permission]
      : [];
  if (
    requiredPermissions.some((key) => !hasPermission(key)) ||
    (anyPermissions && !anyPermissions.some(hasPermission))
  ) {
    const fallback = [
      ["dashboard.view", "/dashboard"],
      ["jobs.read", "/jobs"],
      ["timesheets.read", "/timesheets"],
      ["profile.read", "/profile"],
    ].find(([key]) => hasPermission(key));
    return <Navigate to={fallback?.[1] || "/"} replace />;
  }
  return children;
};

export default PrivateRoute;
