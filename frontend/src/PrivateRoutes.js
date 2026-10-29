import { Box, CircularProgress } from "@mui/material";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  }
  if (status !== "authenticated" || !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "staff" ? "/jobs" : "/dashboard"} replace />;
  }
  return children;
};

export default PrivateRoute;
