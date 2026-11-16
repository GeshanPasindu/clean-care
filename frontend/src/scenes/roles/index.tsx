import { zodResolver } from "@hookform/resolvers/zod";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import FormField from "../../components/forms/FormField";
import Header from "../../components/Header";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { pageContainerSx } from "../../styles/uiStyles";
import type { Permission, Role } from "../../types/domain";
import { errorMessage } from "../../utils/errors";
import { roleFormSchema, type RoleValues } from "../../validation/forms";

const emptyForm: RoleValues = {
  name: "",
  description: "",
  scope: "staff",
  permissionKeys: [],
  isActive: true,
};

export default function Roles() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const { control, handleSubmit, reset, setValue, getValues } =
    useForm<RoleValues>({
      defaultValues: emptyForm,
      resolver: zodResolver(roleFormSchema),
    });
  const form = useWatch({ control, defaultValue: emptyForm });
  const [error, setError] = useState("");
  const rolesQuery = useServiceQuery(["roles", "list"], () =>
    roleService.getAll({ includeInactive: true }),
  );
  const permissionsQuery = useServiceQuery(
    ["roles", "permissions"],
    roleService.getPermissions,
  );
  const permissions = permissionsQuery.data?.permissions || [];
  const roles = rolesQuery.data?.roles || [];
  const groupedPermissions = useMemo(
    () =>
      permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
        const group = permission.group || "Other";
        groups[group] ||= [];
        groups[group].push(permission);
        return groups;
      }, {}),
    [permissions],
  );

  const invalidate = [["roles"], ["roles", "assignable"]];
  const createRole = useServiceMutation(roleService.create, { invalidate });
  const updateRole = useServiceMutation(
    ({ id, values }: { id: string; values: Partial<RoleValues> }) =>
      roleService.update(id, values),
    { invalidate },
  );
  const deactivateRole = useServiceMutation(roleService.remove, { invalidate });

  const openCreate = () => {
    setSelectedRole(null);
    reset(emptyForm);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setSelectedRole(role);
    reset({
      name: role.name,
      description: role.description || "",
      scope: role.scope === "tenant" ? "tenant" : "staff",
      permissionKeys: (role.permissions || []).map(
        (permission) => permission.key,
      ),
      isActive: role.isActive,
    });
    setError("");
    setDialogOpen(true);
  };

  const togglePermission = (key: string) => {
    const current = getValues("permissionKeys");
    setValue(
      "permissionKeys",
      current.includes(key)
        ? current.filter((permission) => permission !== key)
        : [...current, key],
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const handleSave = handleSubmit(async (values) => {
    setError("");
    try {
      if (selectedRole) {
        await updateRole.mutateAsync({
          id: selectedRole._id,
          values: {
            name: values.name,
            description: values.description,
            permissionKeys: values.permissionKeys,
            isActive: values.isActive,
          },
        });
      } else {
        await createRole.mutateAsync(values);
      }
      setDialogOpen(false);
    } catch (requestError) {
      setError(errorMessage(requestError) || "Could not save this role.");
    }
  });

  const handleDeactivate = async (role: Role) => {
    if (!window.confirm(`Deactivate the ${role.name} role?`)) return;
    setError("");
    try {
      await deactivateRole.mutateAsync(role._id);
    } catch (requestError) {
      setError(errorMessage(requestError) || "Could not deactivate this role.");
    }
  };

  const saving = createRole.isPending || updateRole.isPending;

  return (
    <Box sx={pageContainerSx}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          mb: 2,
        }}
      >
        <Header
          title="Roles and permissions"
          subtitle="Define access by role, then assign that role to user accounts."
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Add role
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {rolesQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {rolesQuery.error.message || "Could not load roles."}
        </Alert>
      )}
      {permissionsQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {permissionsQuery.error.message || "Could not load permissions."}
        </Alert>
      )}
      <Grid container spacing={2}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} lg={4} key={role._id}>
            <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography variant="h5" fontWeight={700}>
                    {role.name}
                  </Typography>
                  <Chip size="small" label={role.scope} />
                </Stack>
                <Typography
                  color="text.secondary"
                  sx={{ mt: 1, minHeight: 42 }}
                >
                  {role.description || "No description provided."}
                </Typography>
                <Stack direction="row" gap={1} sx={{ my: 1.5 }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${role.permissions?.length || 0} permissions`}
                  />
                  {!role.isActive && (
                    <Chip size="small" color="default" label="Inactive" />
                  )}
                  {role.isSystem && (
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label="System role"
                    />
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => openEdit(role)}
                    disabled={role.scope === "platform"}
                  >
                    Edit permissions
                  </Button>
                  {!role.isSystem && role.isActive && (
                    <Button
                      size="small"
                      color="warning"
                      startIcon={<BlockIcon />}
                      onClick={() => handleDeactivate(role)}
                    >
                      Deactivate
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <Box component="form" onSubmit={handleSave} noValidate>
          <DialogTitle>
            {selectedRole ? `Edit ${selectedRole.name}` : "Create role"}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <FormField
                control={control}
                label="Role name"
                name="name"
                required
                fullWidth
              />
              <FormField
                control={control}
                label="Description"
                name="description"
                fullWidth
                multiline
                minRows={2}
              />
              {!selectedRole && (
                <FormControl fullWidth>
                  <FormField
                    control={control}
                    name="scope"
                    label="Account scope"
                    select
                  >
                    <MenuItem value="tenant">Tenant account</MenuItem>
                    <MenuItem value="staff">Staff account</MenuItem>
                  </FormField>
                  <FormHelperText>
                    Scope determines which account workflow and data boundary
                    the role uses.
                  </FormHelperText>
                </FormControl>
              )}
              {selectedRole && (
                <FormControl fullWidth>
                  <InputLabel id="role-active-label">Status</InputLabel>
                  <Select
                    labelId="role-active-label"
                    label="Status"
                    value={form.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      setValue("isActive", event.target.value === "active", {
                        shouldDirty: true,
                      })
                    }
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive" disabled={selectedRole.isSystem}>
                      Inactive
                    </MenuItem>
                  </Select>
                </FormControl>
              )}
              <Typography variant="h6">Permissions</Typography>
              {Object.entries(groupedPermissions).map(
                ([group, groupPermissions]) => (
                  <Box key={group}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      {group}
                    </Typography>
                    <Grid container>
                      {groupPermissions.map((permission) => (
                        <Grid item xs={12} sm={6} key={permission.key}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={(form.permissionKeys || []).includes(
                                  permission.key,
                                )}
                                onChange={() =>
                                  togglePermission(permission.key)
                                }
                              />
                            }
                            label={permission.name}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                ),
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                saving || !form.name?.trim() || permissionsQuery.isLoading
              }
            >
              {saving ? "Saving…" : "Save role"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
