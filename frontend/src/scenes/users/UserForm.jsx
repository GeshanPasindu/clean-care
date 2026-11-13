import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { userService } from "../../services/userService";
import { formPageSx } from "../../styles/uiStyles";
import { userQueryKeys } from "./userQueries";

const emptyUser = {
  userName: "", email: "", password: "", roleId: "", firstName: "", lastName: "", address: "", phoneNumber: "",
  dateOfBirth: "", position: "", dateOfHire: "", empContactName: "", empPhoneNumber: "", bankAcNo: "", bankName: "",
  bankAcBranch: "", payFrequency: "Weekly", notes: "", tenantId: "",
};

const fields = [
  ["firstName", "First name"], ["lastName", "Last name"], ["userName", "User name"], ["email", "Email"],
  ["address", "Address"], ["phoneNumber", "Phone number"], ["dateOfBirth", "Date of birth", "date"],
  ["position", "Position"], ["dateOfHire", "Date of hire", "date"], ["empContactName", "Emergency contact"],
  ["empPhoneNumber", "Emergency contact phone"], ["bankAcNo", "Bank account number"], ["bankName", "Bank name"],
  ["bankAcBranch", "Bank branch"],
];

const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";

const generateInitialPassword = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => characters[byte % characters.length]).join("");
};

export default function UserForm({ editing = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: actor, hasPermission } = useAuth();
  const [form, setForm] = useState(emptyUser);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const canAssignRole = hasPermission("users.assignRole");
  const canAssignTenant = hasPermission("users.tenant.assign");
  const canReadBank = hasPermission("users.bank.read");
  const isEditingSelf = editing && String(id) === String(actor?.id);
  const canEditBank = hasPermission("users.bank.update") || isEditingSelf;
  const showBankFields = canReadBank || canEditBank;
  const visibleFields = fields.filter(([name]) => showBankFields || !["bankAcNo", "bankName", "bankAcBranch"].includes(name));
  const canChooseRoleOnCreate = !editing && actor?.scope === "platform" && canAssignRole;
  const rolesQuery = useServiceQuery(["roles", "assignable"], roleService.getAssignable, { enabled: canChooseRoleOnCreate });
  const accountQuery = useServiceQuery(userQueryKeys.detail(id), () => userService.getById(id), { enabled: editing && Boolean(id) });
  const supervisorsQuery = useServiceQuery(
    ["users", "list", { scope: "tenant", status: "active", limit: 100 }],
    () => userService.getAll({ scope: "tenant", status: "active", limit: 100 }),
    { enabled: canAssignTenant }
  );
  const roles = rolesQuery.data?.roles || [];
  const account = accountQuery.data?.user;
  const roleOptions = roles;
  const createUser = useServiceMutation(userService.create, { invalidate: [userQueryKeys.all] });
  const updateUser = useServiceMutation(({ values }) => userService.update(id, values), {
    invalidate: [userQueryKeys.all, userQueryKeys.detail(id)],
  });

  useEffect(() => {
    if (!account) return;
    setForm({
      ...emptyUser,
      ...Object.fromEntries(Object.keys(emptyUser).map((key) => [key, account[key] ?? emptyUser[key]])),
      roleId: account.roleId || "",
      tenantId: account.tenantId || "",
      dateOfBirth: dateInput(account.dateOfBirth),
      dateOfHire: dateInput(account.dateOfHire),
      password: "",
    });
  }, [account]);

  useEffect(() => {
    if (!editing && !form.roleId && roles.length) {
      setForm((current) => ({ ...current, roleId: roles[0]._id }));
    }
  }, [editing, form.roleId, roles]);

  const selectedRole = roles.find((role) => String(role._id) === String(form.roleId));
  const loading = createUser.isPending || updateUser.isPending;

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.userName.trim() || !form.email.trim() || (canChooseRoleOnCreate && !form.roleId)) {
      setError(canChooseRoleOnCreate ? "Enter a user name and email, then choose a role." : "Enter a user name and email.");
      return;
    }
    if (!editing && form.password.length < 10) {
      setError("Set an initial password with at least 10 characters.");
      return;
    }
    if (selectedRole?.scope === "staff" && actor?.scope === "platform" && !form.tenantId) {
      setError("Choose the tenant supervisor for this account.");
      return;
    }

    const values = { ...form };
    if (!canEditBank) {
      delete values.bankAcNo;
      delete values.bankName;
      delete values.bankAcBranch;
    }
    if (editing) {
      delete values.password;
      delete values.roleId;
      delete values.tenantId;
    } else if (actor?.scope !== "platform") {
      delete values.roleId;
      delete values.tenantId;
    }

    try {
      if (editing) await updateUser.mutateAsync({ values });
      else await createUser.mutateAsync(values);
      navigate("/users", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Could not save this user.");
    }
  };

  if (editing && accountQuery.isPending) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}><CircularProgress /></Box>;
  if (editing && accountQuery.isError) return <Alert severity="error">{accountQuery.error.message || "Could not load this user."}</Alert>;

  return (
    <Box sx={formPageSx}>
      <Header title={editing ? `Edit ${account?.firstName || account?.userName || "user"}` : "Create user"} subtitle="Account and employment details are stored on the same user record." />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {rolesQuery.isError && canAssignRole && <Alert severity="error" sx={{ mb: 2 }}>{rolesQuery.error.message || "Could not load roles."}</Alert>}
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          {!editing && actor?.scope === "platform" && canAssignRole && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="filled" required>
                <InputLabel id="user-role-label">Role</InputLabel>
                <Select labelId="user-role-label" value={form.roleId} label="Role" onChange={(event) => setField("roleId", event.target.value)}>
                  {roleOptions.map((role) => <MenuItem key={role._id} value={role._id}>{role.name} ({role.scope})</MenuItem>)}
                </Select>
                <FormHelperText>Assign access through a role. Role changes are managed separately.</FormHelperText>
              </FormControl>
            </Grid>
          )}
          {!editing && selectedRole?.scope === "staff" && actor?.scope === "platform" && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="filled" required>
                <InputLabel id="user-supervisor-label">Tenant supervisor</InputLabel>
                <Select labelId="user-supervisor-label" value={form.tenantId || ""} label="Tenant supervisor" onChange={(event) => setField("tenantId", event.target.value)}>
                  {(supervisorsQuery.data?.users || []).map((supervisor) => (
                    <MenuItem key={supervisor._id} value={supervisor._id}>
                      {[supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.userName} ({supervisor.email})
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{supervisorsQuery.isError ? "Could not load supervisor accounts." : "Staff accounts use this account as their tenant owner."}</FormHelperText>
              </FormControl>
            </Grid>
          )}
          {visibleFields.map(([name, label, type = "text"]) => (
            <Grid item xs={12} md={name === "address" ? 12 : 6} key={name}>
              <TextField
                fullWidth
                variant="filled"
                label={label}
                type={type}
                value={form[name] || ""}
                onChange={(event) => setField(name, event.target.value)}
                InputLabelProps={type === "date" ? { shrink: true } : undefined}
              />
            </Grid>
          ))}
          {!editing && (
            <Grid item xs={12} md={6}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  fullWidth
                  variant="filled"
                  label="Initial password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          type="button"
                          size="small"
                          aria-label={showPassword ? "Hide initial password" : "Show initial password"}
                          onClick={() => setShowPassword((current) => !current)}
                          disabled={!form.password || loading}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  disabled={loading}
                  onClick={() => {
                    setField("password", generateInitialPassword());
                    setShowPassword(true);
                  }}
                >
                  Generate
                </Button>
              </Box>
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth variant="filled">
              <InputLabel id="user-pay-frequency-label">Pay frequency</InputLabel>
              <Select labelId="user-pay-frequency-label" value={form.payFrequency} label="Pay frequency" onChange={(event) => setField("payFrequency", event.target.value)}>
                <MenuItem value="Weekly">Weekly</MenuItem>
                <MenuItem value="Monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth variant="filled" label="Notes" multiline minRows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
          </Grid>
          <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
            <Button onClick={() => navigate(-1)} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading || (editing && accountQuery.isPending)}>
              {loading ? "Saving…" : editing ? "Save user" : "Create user"}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
