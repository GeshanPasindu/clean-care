import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
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
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import background from "../../assets/background.jpg";
import Brand from "../../components/Brand";
import { useAuth } from "../../auth/AuthContext";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const { login: authenticate } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validate = () => {
    const nextErrors = { email: "", password: "" };
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email) nextErrors.email = "Enter your email address";
    else if (!emailPattern.test(formData.email)) nextErrors.email = "Enter a valid email address";

    if (!formData.password) nextErrors.password = "Enter your password";

    setErrors(nextErrors);
    return !nextErrors.email && !nextErrors.password;
  };

  const login = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const user = await authenticate(formData);
      setNotification({ open: true, severity: "success", message: "Welcome back" });
      navigate(user.role === "staff" ? "/jobs" : "/dashboard", { replace: true });
    } catch (error) {
      console.error(error);
      setNotification({
        open: true,
        severity: "error",
        message: "Sign in failed. Check your email and password, then try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="auth-page" sx={{ backgroundColor: "background.paper" }}>
      <Box className="auth-panel" sx={{ backgroundColor: "background.paper" }}>
        <Box className="auth-form-wrap">
          <Brand />

          <Box sx={{ mt: { xs: 4, sm: 6 }, mb: 3.5 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "2rem", sm: "2.35rem" }, mb: 1 }}>
              Welcome back
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "1rem", lineHeight: 1.6 }}>
              Sign in to manage jobs, clients, staff, and invoices from one place.
            </Typography>
          </Box>

          <Box component="form" onSubmit={login} noValidate>
            <Box sx={{ mb: 2.25 }}>
              <Typography component="label" htmlFor="email" sx={{ display: "block", mb: 0.75, fontWeight: 600 }}>
                Email address
              </Typography>
              <TextField
                fullWidth
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                error={Boolean(errors.email)}
                helperText={errors.email}
                autoFocus
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography component="label" htmlFor="password" sx={{ display: "block", mb: 0.75, fontWeight: 600 }}>
                Password
              </Typography>
              <TextField
                fullWidth
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                error={Boolean(errors.password)}
                helperText={errors.password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((value) => !value)}
                        edge="end"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Button type="submit" fullWidth variant="contained" size="large" disabled={isSubmitting} sx={{ minHeight: 50 }}>
              {isSubmitting ? <CircularProgress color="inherit" size={22} /> : "Sign in"}
            </Button>
          </Box>

          <Typography color="text.secondary" sx={{ mt: "auto", pt: 5, fontSize: "0.8rem" }}>
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
          <Typography sx={{ color: "rgba(255,255,255,0.72)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", mb: 2 }}>
            CleanCare workspace
          </Typography>
          <Typography variant="h1" sx={{ color: "#ffffff", maxWidth: 560, fontSize: { md: "2.8rem", lg: "3.4rem" }, lineHeight: 1.08 }}>
            Keep every operation moving forward.
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.8)", maxWidth: 500, mt: 2.5, fontSize: "1.05rem", lineHeight: 1.7 }}>
            A focused view of the work, people, and payments that power your business.
          </Typography>
        </Box>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() => setNotification((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setNotification((current) => ({ ...current, open: false }))}
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
