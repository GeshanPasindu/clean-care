import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { z } from "zod";
import type { firstLoginInvitationSchema } from "../../types/api";

export interface FirstLoginCredentials {
  invitation: z.infer<typeof firstLoginInvitationSchema>;
  temporaryPassword: string;
  email: string;
}
export default function FirstLoginCredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: FirstLoginCredentials;
  onClose: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const copy = async (value: string, label: string) => {
    setError("");
    setCopied("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied.`);
    } catch {
      setError(
        "Copy is unavailable. Use Show and select the value to copy it manually.",
      );
    }
  };
  return (
    <Dialog open maxWidth="sm" fullWidth onClose={onClose}>
      <DialogTitle>First-login credentials</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="success">
            The account is ready for first-login setup. Send the link and
            temporary password separately.
          </Alert>
          <Typography>{credentials.email}</Typography>
          <TextField
            label="First-login link"
            value={credentials.invitation.url}
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <Button
            onClick={() => copy(credentials.invitation.url, "Login link")}
          >
            Copy login link
          </Button>
          <TextField
            label="Temporary password"
            value={credentials.temporaryPassword}
            type={showPassword ? "text" : "password"}
            autoComplete="off"
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? "Hide password" : "Show password"}
            </Button>
            <Button
              onClick={() =>
                copy(credentials.temporaryPassword, "Temporary password")
              }
            >
              Copy temporary password
            </Button>
          </Stack>
          <Typography variant="body2">
            Expires{" "}
            {new Date(credentials.invitation.expiresAt).toLocaleString()}. The
            link works once, and the user must choose a new password before
            accessing the app.
          </Typography>
          <Typography variant="body2">
            Copy the temporary password before closing. It cannot be retrieved
            later; issue replacement credentials if needed.
          </Typography>
          {copied && <Alert severity="success">{copied}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
