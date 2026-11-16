import { zodResolver } from "@hookform/resolvers/zod";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import type { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
import Header from "../../components/Header";
import FormField from "../../components/forms/FormField";
import { authService } from "../../services/authService";
import { userService } from "../../services/userService";
import { formPageSx } from "../../styles/uiStyles";
import { errorMessage } from "../../utils/errors";
import {
  changePasswordSchema,
  profileFormSchema,
  type ProfileValues,
} from "../../validation/forms";

export function ProfileForm() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { userName: user?.userName || "", email: user?.email || "" },
  });
  const submit = handleSubmit(async (values) => {
    setError("");
    setMessage("");
    try {
      await userService.updateProfile(user?.id, values);
      updateUser(values);
      reset(values);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setError(errorMessage(error));
    }
  });
  return (
    <Box sx={{ ...formPageSx, maxWidth: 900 }}>
      <Header title="My profile" subtitle="Manage your account information" />
      <Button
        sx={{ my: 2 }}
        onClick={() => navigate("/profile/changepassword")}
      >
        Change password
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Box component="form" onSubmit={submit} noValidate sx={{ mt: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormField control={control} name="userName" label="Display name" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              control={control}
              name="email"
              label="Email address"
              type="email"
            />
          </Grid>
        </Grid>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!isDirty || isSubmitting}
          >
            Save changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
export function PasswordForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<z.output<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError("");
    try {
      await authService.changePassword({ currentPassword, newPassword });
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      setError(errorMessage(error));
    }
  });
  return (
    <Box sx={{ ...formPageSx, maxWidth: 760 }}>
      <Header
        title="Change password"
        subtitle="You will sign in again after changing your password."
      />
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={submit}
        noValidate
        sx={{ display: "grid", gap: 3, mt: 3 }}
      >
        {(
          [
            ["currentPassword", "Current password"],
            ["newPassword", "New password"],
            ["confirmPassword", "Confirm password"],
          ] as const
        ).map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={name}
            label={label}
            type={show ? "text" : "password"}
            autoComplete={
              name === "currentPassword" ? "current-password" : "new-password"
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        ))}
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          Change password
        </Button>
      </Box>
    </Box>
  );
}
