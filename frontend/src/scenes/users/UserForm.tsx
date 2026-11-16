import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  MenuItem,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import FormField from "../../components/forms/FormField";
import Header from "../../components/Header";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { userService } from "../../services/userService";
import { formPageSx } from "../../styles/uiStyles";
import type { CreateUserInput, UpdateUserInput } from "../../types/requests";
import { errorMessage } from "../../utils/errors";
import {
  accountFormSchema,
  userDefaults,
  type UserValues,
} from "../../validation/forms";
import { userQueryKeys } from "./userQueries";
import FirstLoginCredentialsDialog, {
  type FirstLoginCredentials,
} from "./FirstLoginCredentials";
import { generateInitialPassword } from "../../utils/passwords";

const fields: ReadonlyArray<readonly [keyof UserValues, string, string?]> = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["userName", "User name"],
  ["email", "Email"],
  ["address", "Address"],
  ["phoneNumber", "Phone number"],
  ["dateOfBirth", "Date of birth", "date"],
  ["position", "Position"],
  ["dateOfHire", "Date of hire", "date"],
  ["empContactName", "Emergency contact"],
  ["empPhoneNumber", "Emergency contact phone"],
  ["bankAcNo", "Bank account number"],
  ["bankName", "Bank name"],
  ["bankAcBranch", "Bank branch"],
] as const;

const dateInput = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export default function UserForm({ editing = false }: { editing?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: actor, hasPermission } = useAuth();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<FirstLoginCredentials | null>(
    null,
  );
  const canAssignRole = hasPermission("users.assignRole");
  const canAssignTenant = hasPermission("users.tenant.assign");
  const canReadBank = hasPermission("users.bank.read");
  const isEditingSelf = editing && String(id) === String(actor?.id);
  const canEditBank = hasPermission("users.bank.update") || isEditingSelf;
  const showBankFields = canReadBank || canEditBank;
  const visibleFields = fields.filter(
    ([name]) =>
      showBankFields ||
      !["bankAcNo", "bankName", "bankAcBranch"].includes(name),
  );
  const canChooseRoleOnCreate =
    !editing && actor?.scope === "platform" && canAssignRole;
  const rolesQuery = useServiceQuery(
    ["roles", "assignable"],
    roleService.getAssignable,
    { enabled: canChooseRoleOnCreate },
  );
  const accountQuery = useServiceQuery(
    userQueryKeys.detail(id),
    () => userService.getById(id),
    { enabled: editing && Boolean(id) },
  );
  const supervisorsQuery = useServiceQuery(
    ["users", "list", { scope: "tenant", status: "active", limit: 100 }],
    () => userService.getAll({ scope: "tenant", status: "active", limit: 100 }),
    { enabled: canAssignTenant },
  );
  const roles = rolesQuery.data?.roles || [];
  const account = accountQuery.data?.user;
  const roleOptions = roles;
  const createUser = useServiceMutation(userService.create, {
    invalidate: [userQueryKeys.all],
    gcTime: 0,
  });
  const updateUser = useServiceMutation(
    ({ values }: { values: UpdateUserInput }) => userService.update(id, values),
    {
      invalidate: [userQueryKeys.all, userQueryKeys.detail(id)],
    },
  );

  const schema = accountFormSchema({
    editing,
    chooseRole: canChooseRoleOnCreate,
    needsSupervisor: (roleId) =>
      roles.some((role) => role._id === roleId && role.scope === "staff"),
  });
  const { control, handleSubmit, reset, setValue } = useForm<UserValues>({
    defaultValues: userDefaults,
    resolver: zodResolver(schema),
  });
  const form = useWatch({ control });
  useEffect(() => {
    if (!account) return;
    reset({
      ...userDefaults,
      ...account,
      tenantId: account.tenantId || "",
      dateOfBirth: dateInput(account.dateOfBirth),
      dateOfHire: dateInput(account.dateOfHire),
      password: "",
    });
  }, [account, reset]);
  useEffect(() => {
    if (!editing && !form.roleId && roles.length)
      setValue("roleId", roles[0]._id);
  }, [editing, form.roleId, roles, setValue]);
  const selectedRole = roles.find((role) => role._id === form.roleId);
  const loading = createUser.isPending || updateUser.isPending;
  const setField = (name: "password", value: string) =>
    setValue(name, value, { shouldDirty: true, shouldValidate: true });
  const submit = handleSubmit(async (values) => {
    setError("");
    const {
      password,
      roleId,
      tenantId,
      bankAcNo,
      bankName,
      bankAcBranch,
      ...details
    } = values;
    const bank = canEditBank ? { bankAcNo, bankName, bankAcBranch } : {};
    try {
      if (editing)
        await updateUser.mutateAsync({ values: { ...details, ...bank } });
      else {
        const payload: CreateUserInput = {
          ...details,
          ...bank,
          password,
          ...(canChooseRoleOnCreate
            ? {
                roleId,
                ...(selectedRole?.scope === "staff" ? { tenantId } : {}),
              }
            : {}),
        };
        const response = await createUser.mutateAsync(payload);
        setCredentials({
          invitation: response.invitation,
          temporaryPassword: password,
          email: response.user.email || values.email,
        });
        reset(userDefaults);
        createUser.reset();
        return;
      }
      navigate("/users", { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  });

  if (credentials)
    return (
      <FirstLoginCredentialsDialog
        credentials={credentials}
        onClose={() => {
          setCredentials(null);
          navigate("/users", { replace: true });
        }}
      />
    );
  if (editing && accountQuery.isPending)
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
        <CircularProgress />
      </Box>
    );
  if (editing && accountQuery.isError)
    return (
      <Alert severity="error">
        {accountQuery.error.message || "Could not load this user."}
      </Alert>
    );

  return (
    <Box sx={formPageSx}>
      <Header
        title={
          editing
            ? `Edit ${account?.firstName || account?.userName || "user"}`
            : "Create user"
        }
        subtitle="Account and employment details are stored on the same user record."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {rolesQuery.isError && canAssignRole && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {rolesQuery.error.message || "Could not load roles."}
        </Alert>
      )}
      <Box component="form" onSubmit={submit} noValidate sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          {!editing && actor?.scope === "platform" && canAssignRole && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="filled" required>
                <FormField control={control} name="roleId" label="Role" select>
                  {roleOptions.map((role) => (
                    <MenuItem key={role._id} value={role._id}>
                      {role.name} ({role.scope})
                    </MenuItem>
                  ))}
                </FormField>
                <FormHelperText>
                  Assign access through a role. Role changes are managed
                  separately.
                </FormHelperText>
              </FormControl>
            </Grid>
          )}
          {!editing &&
            selectedRole?.scope === "staff" &&
            actor?.scope === "platform" && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth variant="filled" required>
                  <FormField
                    control={control}
                    name="tenantId"
                    label="Tenant supervisor"
                    select
                  >
                    {(supervisorsQuery.data?.users || []).map((supervisor) => (
                      <MenuItem key={supervisor._id} value={supervisor._id}>
                        {[supervisor.firstName, supervisor.lastName]
                          .filter(Boolean)
                          .join(" ") || supervisor.userName}{" "}
                        ({supervisor.email})
                      </MenuItem>
                    ))}
                  </FormField>
                  <FormHelperText>
                    {supervisorsQuery.isError
                      ? "Could not load supervisor accounts."
                      : "Staff accounts use this account as their tenant owner."}
                  </FormHelperText>
                </FormControl>
              </Grid>
            )}
          {visibleFields.map(([name, label, type = "text"]) => (
            <Grid item xs={12} md={name === "address" ? 12 : 6} key={name}>
              <FormField
                control={control}
                fullWidth
                variant="filled"
                name={name}
                label={label}
                type={type}
                InputLabelProps={type === "date" ? { shrink: true } : undefined}
              />
            </Grid>
          ))}
          {!editing && (
            <Grid item xs={12} md={6}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FormField
                  control={control}
                  fullWidth
                  variant="filled"
                  label="Initial password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  name="password"

                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          type="button"
                          size="small"
                          aria-label={
                            showPassword
                              ? "Hide initial password"
                              : "Show initial password"
                          }
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
              <FormField
                control={control}
                name="payFrequency"
                label="Preferred cleaner payment frequency"
                helperText="Supervisor salary periods are configured under Employee Payments."
                select
              >
                <MenuItem value="Daily">Daily</MenuItem>
                <MenuItem value="PerJob">Per job</MenuItem>
                <MenuItem value="Weekly">Weekly</MenuItem>
                <MenuItem value="Monthly">Monthly</MenuItem>
              </FormField>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormField
              control={control}
              fullWidth
              variant="filled"
              label="Notes"
              multiline
              minRows={3}
              name="notes"
            />
          </Grid>
          <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
            <Button onClick={() => navigate(-1)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || (editing && accountQuery.isPending)}
            >
              {loading ? "Saving…" : editing ? "Save user" : "Create user"}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
