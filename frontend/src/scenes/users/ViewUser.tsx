import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import DetailGrid from "../../components/DetailGrid";
import Header from "../../components/Header";
import {
  useServiceQuery,
  useServiceMutation,
} from "../../queries/queryHelpers";
import { userService } from "../../services/userService";
import { pageContainerSx } from "../../styles/uiStyles";
import { generateInitialPassword } from "../../utils/passwords";
import { errorMessage } from "../../utils/errors";
import FirstLoginCredentialsDialog, {
  type FirstLoginCredentials,
} from "./FirstLoginCredentials";

export default function ViewUser() {
  const { id } = useParams();
  const { user: actor, hasPermission } = useAuth();
  const query = useServiceQuery(
    ["users", "detail", id],
    () => userService.getById(id),
    { enabled: Boolean(id) },
  );
  const user = query.data?.user;
  const [credentials, setCredentials] = useState<FirstLoginCredentials | null>(
    null,
  );
  const [invitationError, setInvitationError] = useState("");
  const replaceInvitation = useServiceMutation(
    (password: string) =>
      userService.replaceFirstLoginInvitation(id || "", password),
    { gcTime: 0 },
  );
  const replaceCredentials = async () => {
    if (
      !user ||
      !window.confirm(
        "Replace the first-login link and temporary password? The previous credentials will stop working.",
      )
    )
      return;
    const password = generateInitialPassword();
    setInvitationError("");
    try {
      const result = await replaceInvitation.mutateAsync(password);
      setCredentials({
        invitation: result.invitation,
        temporaryPassword: password,
        email: user.email || "",
      });
    } catch (failure) {
      setInvitationError(errorMessage(failure));
    } finally {
      replaceInvitation.reset();
    }
  };

  if (query.isPending)
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
        <CircularProgress />
      </Box>
    );
  if (query.isError)
    return (
      <Alert severity="error">
        {query.error.message || "Could not load this account."}
      </Alert>
    );

  const details: Record<string, string> = {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    userName: user?.userName || "",
    email: user?.email || "",
    role: user?.roleName || "",
    accountType: user?.scope || "",
    status: user?.status || "",
    firstLogin: user?.mustChangePassword
      ? "Awaiting password setup"
      : "Complete",
    address: user?.address || "",
    phoneNumber: user?.phoneNumber || "",
    dateOfBirth: user?.dateOfBirth || "",
    position: user?.position || "",
    dateOfHire: user?.dateOfHire || "",
    emergencyContact: user?.empContactName || "",
    emergencyPhone: user?.empPhoneNumber || "",
    bankAccountNumber: user?.bankAcNo || "",
    bankName: user?.bankName || "",
    bankBranch: user?.bankAcBranch || "",
    payFrequency: user?.payFrequency || "",
    notes: user?.notes || "",
    supervisor: user?.supervisorName || "",
  };
  if (
    !hasPermission("users.bank.read") &&
    String(user?._id) !== String(actor?.id)
  ) {
    delete details.bankAccountNumber;
    delete details.bankName;
    delete details.bankBranch;
  }

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Header
          title="User account"
          subtitle={
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.userName
          }
        />
        {hasPermission("users.update") && (
          <Link to={`/users/${id}/edit`}>
            <Button variant="contained">Edit account</Button>
          </Link>
        )}
      </Stack>
      {invitationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {invitationError}
        </Alert>
      )}
      {user?.mustChangePassword &&
        user.status === "active" &&
        user.scope !== "platform" &&
        user._id !== actor?.id &&
        hasPermission("users.password.reset") && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button
                disabled={replaceInvitation.isPending}
                onClick={replaceCredentials}
              >
                Replace first-login credentials
              </Button>
            }
          >
            This user must set a permanent password before accessing the app.
          </Alert>
        )}
      <DetailGrid data={details} exclude={[]} />
      {credentials && (
        <FirstLoginCredentialsDialog
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </Box>
  );
}
