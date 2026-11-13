import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as ViewIcon, WorkHistory as WorkHistoryIcon } from "@mui/icons-material";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, TextField } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { userService } from "../../services/userService";
import { actionButtonSx, pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../styles/uiStyles";
import { userQueryKeys } from "./userQueries";

export default function Users() {
  const { user, hasPermission } = useAuth();
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleId, setRoleId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [roleError, setRoleError] = useState("");
  const isPlatform = user?.scope === "platform";
  const params = { ...(scope ? { scope } : {}), page: page + 1, limit: pageSize, ...(search ? { search } : {}) };
  const usersQuery = useServiceQuery(userQueryKeys.list(params), () => userService.getAll(params));
  const statusMutation = useServiceMutation(({ id, status }) => userService.updateStatus(id, status), {
    invalidate: [userQueryKeys.all],
  });
  const deleteMutation = useServiceMutation(userService.remove, { invalidate: [userQueryKeys.all] });
  const roleMutation = useServiceMutation(
    ({ id, values }) => userService.changeRole(id, values),
    { invalidate: [userQueryKeys.all] }
  );
  const rolesQuery = useServiceQuery(["roles", "assignable"], roleService.getAssignable, {
    enabled: isPlatform && hasPermission("users.assignRole"),
  });
  const supervisorsQuery = useServiceQuery(
    ["users", "list", { scope: "tenant", status: "active", limit: 100 }],
    () => userService.getAll({ scope: "tenant", status: "active", limit: 100 }),
    { enabled: Boolean(roleTarget && rolesQuery.data?.roles?.some((role) => String(role._id) === String(roleId) && role.scope === "staff")) }
  );
  const canUpdate = hasPermission("users.update");
  const canChangeStatus = hasPermission("users.status.update");
  const canDelete = hasPermission("users.delete");
  const canViewBank = hasPermission("users.bank.read");
  const canCreate = hasPermission("users.create") && (!isPlatform || hasPermission("users.assignRole"));
  const rows = (usersQuery.data?.users || []).map((account) => ({ ...account, id: account._id }));
  const paginationInfo = usersQuery.data?.paginationInfo || {};
  const roleOptions = rolesQuery.data?.roles || [];
  const selectedRole = roleOptions.find((role) => String(role._id) === String(roleId));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const handleDelete = async (account) => {
    if (!window.confirm(`Soft-delete ${account.userName}'s account?`)) return;
    try {
      await deleteMutation.mutateAsync(account._id);
    } catch (error) {
      window.alert(error.message || "Could not delete this account.");
    }
  };

  const openRoleDialog = (account) => {
    setRoleTarget(account);
    setRoleId(account.roleId);
    setTenantId(account.tenantId || "");
    setRoleError("");
  };

  const saveRole = async () => {
    setRoleError("");
    if (!selectedRole) return setRoleError("Choose a role.");
    if (selectedRole.scope === "staff" && !tenantId) return setRoleError("Choose the tenant supervisor for this user.");
    try {
      await roleMutation.mutateAsync({
        id: roleTarget._id,
        values: { roleId, ...(selectedRole.scope === "staff" ? { tenantId } : {}) },
      });
      setRoleTarget(null);
    } catch (error) {
      setRoleError(error.message || "Could not change this user's role.");
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      valueGetter: (params) => [params.row.firstName, params.row.lastName].filter(Boolean).join(" ") || params.row.userName,
    },
    { field: "userName", headerName: "User name", flex: 0.8, minWidth: 130 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "roleName", headerName: "Role", flex: 0.8, minWidth: 130 },
    { field: "scope", headerName: "Account type", flex: 0.65, minWidth: 120 },
    ...(canViewBank ? [{ field: "bankName", headerName: "Bank", flex: 0.7, minWidth: 120 }] : []),
    {
      field: "status",
      headerName: "Status",
      flex: 0.65,
      minWidth: 120,
      renderCell: (params) => canChangeStatus ? (
        <Select
          size="small"
          value={params.row.status}
          disabled={statusMutation.isPending}
          onChange={(event) => statusMutation.mutate({ id: params.row.id, status: event.target.value })}
        >
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </Select>
      ) : params.row.status,
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1.2,
      minWidth: 210,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box>
          <Link to={`/users/${params.row.id}`} aria-label="View user"><Button size="small" aria-label="View"><ViewIcon fontSize="small" /></Button></Link>
          {canUpdate && <Link to={`/users/${params.row.id}/edit`} aria-label="Edit user"><Button size="small" aria-label="Edit"><EditIcon fontSize="small" /></Button></Link>}
          {isPlatform && hasPermission("users.assignRole") && params.row.scope !== "platform" && <Button size="small" onClick={() => openRoleDialog(params.row)}>Role</Button>}
          {hasPermission("jobs.assigned.read") && <Link to={`/users/${params.row.id}/jobs`} aria-label="View assigned jobs"><Button size="small" aria-label="Assigned jobs"><WorkHistoryIcon fontSize="small" /></Button></Link>}
          {canDelete && String(user?.id) !== String(params.row.id) && <Button size="small" color="error" aria-label="Delete user" onClick={() => handleDelete(params.row)}><DeleteIcon fontSize="small" /></Button>}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Users" subtitle="One account directory for administrators, supervisors, and staff." />
        {canCreate && <Link to="/users/new" style={{ textDecoration: "none" }}><Button variant="contained" startIcon={<AddIcon />} sx={actionButtonSx}>Create user</Button></Link>}
      </Box>
      {isPlatform && (
        <Tabs value={scope} onChange={(_event, value) => { setScope(value); setPage(0); }} sx={{ mb: 2 }}>
          <Tab value="" label="All Users" />
          <Tab value="tenant" label="Supervisors" />
          <Tab value="staff" label="Staff" />
        </Tabs>
      )}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        {!isPlatform && <Box sx={{ color: "text.secondary", fontSize: 14 }}>All users in your tenant</Box>}
        <TextField size="small" label="Search users" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} sx={{ minWidth: 250 }} />
        {statusMutation.isError && <Alert severity="error">{statusMutation.error.message || "Status update failed."}</Alert>}
        {deleteMutation.isError && <Alert severity="error">{deleteMutation.error.message || "Delete failed."}</Alert>}
      </Box>
      {usersQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>{usersQuery.error.message || "Could not load users."}</Alert>}
      <Box sx={tableSurfaceSx}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={usersQuery.isPending}
          autoHeight
          page={page}
          pageSize={pageSize}
          rowCount={paginationInfo.totalResult || 0}
          paginationMode="server"
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(0); }}
          components={{ Toolbar: GridToolbar }}
          disableSelectionOnClick
        />
      </Box>
      <Dialog open={Boolean(roleTarget)} onClose={() => !roleMutation.isPending && setRoleTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Change user role</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          {roleError && <Alert severity="error">{roleError}</Alert>}
          {rolesQuery.isError && <Alert severity="error">{rolesQuery.error.message || "Could not load roles."}</Alert>}
          <FormControl fullWidth>
            <InputLabel id="change-user-role-label">Role</InputLabel>
            <Select labelId="change-user-role-label" label="Role" value={roleId} onChange={(event) => {
              const nextRoleId = event.target.value;
              const nextRole = roleOptions.find((role) => String(role._id) === String(nextRoleId));
              setRoleId(nextRoleId);
              if (nextRole?.scope === "staff" && String(tenantId) === String(roleTarget?._id)) setTenantId("");
            }}>
              {roleOptions.map((role) => <MenuItem key={role._id} value={role._id}>{role.name} ({role.scope})</MenuItem>)}
            </Select>
          </FormControl>
          {selectedRole?.scope === "staff" && (
            <FormControl fullWidth>
              <InputLabel id="change-user-supervisor-label">Supervisor</InputLabel>
              <Select labelId="change-user-supervisor-label" label="Supervisor" value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
                {(supervisorsQuery.data?.users || [])
                  .filter((supervisor) => String(supervisor._id) !== String(roleTarget?._id))
                  .map((supervisor) => (
                  <MenuItem key={supervisor._id} value={supervisor._id}>
                    {[supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.userName}
                  </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleTarget(null)} disabled={roleMutation.isPending}>Cancel</Button>
          <Button onClick={saveRole} variant="contained" disabled={roleMutation.isPending || rolesQuery.isPending || !selectedRole}>Save role</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
