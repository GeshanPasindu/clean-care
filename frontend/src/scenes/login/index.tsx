import { zodResolver } from "@hookform/resolvers/zod";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { AlertColor } from "@mui/material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import background from "../../assets/background.jpg";
import { useAuth } from "../../auth/AuthContext";
import Brand from "../../components/Brand";
import { loginSchema, type LoginValues } from "../../validation/forms";
import { ApiError } from "../../services/apiClient";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const { login: authenticate } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    severity: AlertColor;
    message: string;
  }>({
    open: false,
    severity: "success",
    message: "",
  });

  const login = handleSubmit(async (formData) => {
    try {
      const user = await authenticate(formData);
      setNotification({
        open: true,
        severity: "success",
        message: "Welcome back",
      });
      const destination = user.permissions?.includes("dashboard.view")
        ? "/dashboard"
        : user.permissions?.includes("jobs.read")
          ? "/jobs"
          : "/profile";
      navigate(destination, { replace: true });
    } catch (error) {
      setNotification({
        open: true,
        severity: "error",
        message:
          error instanceof ApiError && error.status === 403
            ? error.message
            : "Sign in failed. Check your email and password, then try again.",
      });
    }
  });

  return (
    <Box className="auth-page" sx={{ backgroundColor: "background.paper" }}>
      <Box className="auth-panel" sx={{ backgroundColor: "background.paper" }}>
        <Box className="auth-form-wrap">
          <Brand />

          <Box sx={{ mt: { xs: 4, sm: 6 }, mb: 3.5 }}>
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: "2rem", sm: "2.35rem" }, mb: 1 }}
            >
              Welcome back
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ fontSize: "1rem", lineHeight: 1.6 }}
            >
              Sign in to manage jobs, clients, staff, and invoices from one
              place.
            </Typography>
          </Box>

          <Box component="form" onSubmit={login} noValidate>
            <Box sx={{ mb: 2.25 }}>
              <Typography
                component="label"
                htmlFor="email"
                sx={{ display: "block", mb: 0.75, fontWeight: 600 }}
              >
                Email address
              </Typography>
              <TextField
                fullWidth
                id="email"
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                autoFocus
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography
                component="label"
                htmlFor="password"
                sx={{ display: "block", mb: 0.75, fontWeight: 600 }}
              >
                Password
              </Typography>
              <TextField
                fullWidth
                id="password"
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((value) => !value)}
                        edge="end"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <VisibilityOffOutlinedIcon />
                        ) : (
                          <VisibilityOutlinedIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ minHeight: 50 }}
            >
              {isSubmitting ? (
                <CircularProgress color="inherit" size={22} />
              ) : (
                "Sign in"
              )}
            </Button>
          </Box>

          <Typography
            color="text.secondary"
            sx={{ mt: "auto", pt: 5, fontSize: "0.8rem" }}
          >
            Secure administration portal
          </Typography>
        </Box>
      </Box>

      <Box
        className="auth-visual"
        sx={{
          backgroundImage: `linear-gradient(145deg, rgba(15, 23, 42, 0.2), rgba(49, 46, 129, 0.72)), url(${background})`,
        }}
      >
        <Box className="auth-visual-copy">
          <Typography
            sx={{
              color: "rgba(255,255,255,0.72)",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              mb: 2,
            }}
          >
            CleanCare workspace
          </Typography>
          <Typography
            variant="h1"
            sx={{
              color: "#ffffff",
              maxWidth: 560,
              fontSize: { md: "2.8rem", lg: "3.4rem" },
              lineHeight: 1.08,
            }}
          >
            Keep every operation moving forward.
          </Typography>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.8)",
              maxWidth: 500,
              mt: 2.5,
              fontSize: "1.05rem",
              lineHeight: 1.7,
            }}
          >
            A focused view of the work, people, and payments that power your
            business.
          </Typography>
        </Box>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() =>
          setNotification((current) => ({ ...current, open: false }))
        }
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() =>
            setNotification((current) => ({ ...current, open: false }))
          }
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Login;
