import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import Header from "../../components/Header";
import DetailGrid from "../../components/DetailGrid";
import { useAuth } from "../../auth/AuthContext";
import { useServiceQuery } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";
import { pageContainerSx } from "../../styles/uiStyles";

export default function ViewUser() {
  const { id } = useParams();
  const { user: actor, hasPermission } = useAuth();
  const query = useServiceQuery(["users", "detail", id], () => userService.getById(id), { enabled: Boolean(id) });
  const user = query.data?.user;

  if (query.isPending) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}><CircularProgress /></Box>;
  if (query.isError) return <Alert severity="error">{query.error.message || "Could not load this account."}</Alert>;

  const details = {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    userName: user?.userName || "",
    email: user?.email || "",
    role: user?.roleName || "",
    accountType: user?.scope || "",
    status: user?.status || "",
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
  if (!hasPermission("users.bank.read") && String(user?._id) !== String(actor?.id)) {
    delete details.bankAccountNumber;
    delete details.bankName;
    delete details.bankBranch;
  }

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Header title="User account" subtitle={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.userName} />
        {hasPermission("users.update") && <Link to={`/users/${id}/edit`}><Button variant="contained">Edit account</Button></Link>}
      </Stack>
      <DetailGrid data={details} exclude={[]} />
    </Box>
  );
}
