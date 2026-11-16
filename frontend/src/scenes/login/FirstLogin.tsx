import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../../components/Brand";
import FormField from "../../components/forms/FormField";
import { authService } from "../../services/authService";
import { errorMessage } from "../../utils/errors";
import { firstLoginSchema, type FirstLoginValues } from "../../validation/auth";

export default function FirstLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FirstLoginValues>({
    resolver: zodResolver(firstLoginSchema),
    defaultValues: {
      temporaryPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  useEffect(() => {
    if (location.hash)
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true },
      );
  }, [location.hash, location.pathname, location.search, navigate]);
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      await authService.completeFirstLogin(token, values);
      reset();
      setToken("");
      setComplete(true);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  });
  return (
    <Box
      sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}
    >
      <Box sx={{ width: "100%", maxWidth: 500 }}>
        <Brand />
        <Typography variant="h3" sx={{ my: 3 }}>
          Set your permanent password
        </Typography>
        {complete ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Your password has been set. Sign in with your email and new
              password.
            </Alert>
            <Button component={Link} to="/" variant="contained">
              Go to sign in
            </Button>
          </Stack>
        ) : !validToken ? (
          <Stack spacing={2}>
            <Alert severity="error">
              This invitation link is missing or invalid. Open the full link
              your administrator sent, or ask for replacement credentials.
            </Alert>
            <Button component={Link} to="/">
              Back to sign in
            </Button>
          </Stack>
        ) : (
          <Box component="form" noValidate onSubmit={submit}>
            <Stack spacing={2}>
              <Typography>
                Enter the temporary password sent separately by your
                administrator, then choose your own password.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              <FormField
                control={control}
                name="temporaryPassword"
                label="Temporary password"
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <FormField
                control={control}
                name="newPassword"
                label="New password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                disabled={isSubmitting}
                helperText="Use at least 10 characters."
              />
              <FormField
                control={control}
                name="confirmPassword"
                label="Confirm new password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <Button
                disabled={isSubmitting}
                onClick={() => setShowPasswords((current) => !current)}
              >
                {showPasswords ? "Hide passwords" : "Show passwords"}
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                Set password
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
