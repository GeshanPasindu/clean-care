import { Add as AddIcon, Edit as EditIcon, Block as BlockIcon } from "@mui/icons-material";
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
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import Header from "../../components/Header";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { pageContainerSx } from "../../styles/uiStyles";

const emptyForm = { name: "", description: "", scope: "staff", permissionKeys: [], isActive: true };

export default function Roles() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const rolesQuery = useServiceQuery(["roles", "list"], () => roleService.getAll({ includeInactive: true }));
  const permissionsQuery = useServiceQuery(["roles", "permissions"], roleService.getPermissions);
  const permissions = permissionsQuery.data?.permissions || [];
  const roles = rolesQuery.data?.roles || [];
  const groupedPermissions = useMemo(() => permissions.reduce((groups, permission) => {
    const group = permission.group || "Other";
    groups[group] ||= [];
    groups[group].push(permission);
    return groups;
  }, {}), [permissions]);

  const invalidate = [["roles"], ["roles", "assignable"]];
  const createRole = useServiceMutation(roleService.create, { invalidate });
  const updateRole = useServiceMutation(({ id, values }) => roleService.update(id, values), { invalidate });
  const deactivateRole = useServiceMutation(roleService.remove, { invalidate });

  const openCreate = () => {
    setSelectedRole(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setSelectedRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      scope: role.scope,
      permissionKeys: (role.permissions || []).map((permission) => permission.key),
      isActive: role.isActive,
    });
    setError("");
    setDialogOpen(true);
  };

  const togglePermission = (key) => {
    setForm((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(key)
        ? current.permissionKeys.filter((permissionKey) => permissionKey !== key)
        : [...current.permissionKeys, key],
    }));
  };

  const handleSave = async () => {
    setError("");
    try {
      if (selectedRole) {
        await updateRole.mutateAsync({ id: selectedRole._id, values: {
          name: form.name,
          description: form.description,
          permissionKeys: form.permissionKeys,
          isActive: form.isActive,
        } });
      } else {
        await createRole.mutateAsync(form);
      }
      setDialogOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Could not save this role.");
    }
  };

  const handleDeactivate = async (role) => {
    if (!window.confirm(`Deactivate the ${role.name} role?`)) return;
    setError("");
    try {
      await deactivateRole.mutateAsync(role._id);
    } catch (requestError) {
      setError(requestError.message || "Could not deactivate this role.");
    }
  };

  const saving = createRole.isPending || updateRole.isPending;

  return (
    <Box sx={pageContainerSx}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2 }}>
        <Header title="Roles and permissions" subtitle="Define access by role, then assign that role to user accounts." />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add role</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {rolesQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>{rolesQuery.error.message || "Could not load roles."}</Alert>}
      {permissionsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>{permissionsQuery.error.message || "Could not load permissions."}</Alert>}
      <Grid container spacing={2}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} lg={4} key={role._id}>
            <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography variant="h5" fontWeight={700}>{role.name}</Typography>
                  <Chip size="small" label={role.scope} />
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 1, minHeight: 42 }}>
                  {role.description || "No description provided."}
                </Typography>
                <Stack direction="row" gap={1} sx={{ my: 1.5 }}>
                  <Chip size="small" variant="outlined" label={`${role.permissions?.length || 0} permissions`} />
                  {!role.isActive && <Chip size="small" color="default" label="Inactive" />}
                  {role.isSystem && <Chip size="small" color="primary" variant="outlined" label="System role" />}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(role)} disabled={role.scope === "platform"}>
                    Edit permissions
                  </Button>
                  {!role.isSystem && role.isActive && (
                    <Button size="small" color="warning" startIcon={<BlockIcon />} onClick={() => handleDeactivate(role)}>
                      Deactivate
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{selectedRole ? `Edit ${selectedRole.name}` : "Create role"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Role name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            {!selectedRole && (
              <FormControl fullWidth>
                <InputLabel id="new-role-scope-label">Account scope</InputLabel>
                <Select
                  labelId="new-role-scope-label"
                  label="Account scope"
                  value={form.scope}
                  onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}
                >
                  <MenuItem value="tenant">Tenant account</MenuItem>
                  <MenuItem value="staff">Staff account</MenuItem>
                </Select>
                <FormHelperText>Scope determines which account workflow and data boundary the role uses.</FormHelperText>
              </FormControl>
            )}
            {selectedRole && (
              <FormControl fullWidth>
                <InputLabel id="role-active-label">Status</InputLabel>
                <Select
                  labelId="role-active-label"
                  label="Status"
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive" disabled={selectedRole.isSystem}>Inactive</MenuItem>
                </Select>
              </FormControl>
            )}
            <Typography variant="h6">Permissions</Typography>
            {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
              <Box key={group}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>{group}</Typography>
                <Grid container>
                  {groupPermissions.map((permission) => (
                    <Grid item xs={12} sm={6} key={permission.key}>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            checked={form.permissionKeys.includes(permission.key)}
                            onChange={() => togglePermission(permission.key)}
                          />
                        )}
                        label={permission.name}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.name.trim() || permissionsQuery.isLoading}>
            {saving ? "Saving…" : "Save role"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
