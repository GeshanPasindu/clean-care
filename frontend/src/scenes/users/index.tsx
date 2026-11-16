import { zodResolver } from "@hookform/resolvers/zod";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ViewIcon from "@mui/icons-material/Visibility";
import WorkHistoryIcon from "@mui/icons-material/WorkHistory";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";
import type { GridColumns } from "@mui/x-data-grid";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import FormField from "../../components/forms/FormField";
import Header from "../../components/Header";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { roleService } from "../../services/roleService";
import { userService } from "../../services/userService";
import {
  actionButtonSx,
  pageContainerSx,
  pageHeaderRowSx,
  tableSurfaceSx,
} from "../../styles/uiStyles";
import type { Pagination } from "../../types/api";
import type { AccountStatus, User } from "../../types/domain";
import { accountStatusSchema } from "../../types/domain";
import { errorMessage } from "../../utils/errors";
import {
  roleAssignmentSchema,
  type RoleAssignment,
} from "../../validation/forms";
import { userQueryKeys } from "./userQueries";

export default function Users() {
  const { user, hasPermission } = useAuth();
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<RoleAssignment>({
      defaultValues: { roleId: "", tenantId: "" },
      resolver: zodResolver(
        roleAssignmentSchema.refine(
          (values) =>
            !rolesQuery.data?.roles.some(
              (role) => role._id === values.roleId && role.scope === "staff",
            ) || Boolean(values.tenantId),
          { path: ["tenantId"], message: "Choose a supervisor" },
        ),
      ),
    });
  const { roleId, tenantId } = watch();
  const [roleError, setRoleError] = useState("");
  const isPlatform = user?.scope === "platform";
  const params = {
    ...(scope ? { scope } : {}),
    page: page + 1,
    limit: pageSize,
    ...(search ? { search } : {}),
  };
  const usersQuery = useServiceQuery(userQueryKeys.list(params), () =>
    userService.getAll(params),
  );
  const statusMutation = useServiceMutation(
    ({ id, status }: { id: string; status: AccountStatus }) =>
      userService.updateStatus(id, status),
    {
      invalidate: [userQueryKeys.all],
    },
  );
  const deleteMutation = useServiceMutation(userService.remove, {
    invalidate: [userQueryKeys.all],
  });
  const roleMutation = useServiceMutation(
    ({ id, values }: { id: string; values: RoleAssignment }) =>
      userService.changeRole(id, values),
    { invalidate: [userQueryKeys.all] },
  );
  const rolesQuery = useServiceQuery(
    ["roles", "assignable"],
    roleService.getAssignable,
    {
      enabled: isPlatform && hasPermission("users.assignRole"),
    },
  );
  const supervisorsQuery = useServiceQuery(
    ["users", "list", { scope: "tenant", status: "active", limit: 100 }],
    () => userService.getAll({ scope: "tenant", status: "active", limit: 100 }),
    {
      enabled: Boolean(
        roleTarget &&
        rolesQuery.data?.roles?.some(
          (role) =>
            String(role._id) === String(roleId) && role.scope === "staff",
        ),
      ),
    },
  );
  const canUpdate = hasPermission("users.update");
  const canChangeStatus = hasPermission("users.status.update");
  const canDelete = hasPermission("users.delete");
  const canViewBank = hasPermission("users.bank.read");
  const canCreate =
    hasPermission("users.create") &&
    (!isPlatform || hasPermission("users.assignRole"));
  const rows = (usersQuery.data?.users || []).map((account: User) => ({
    ...account,
    id: account._id,
  }));
  const paginationInfo: Partial<Pagination> =
    usersQuery.data?.paginationInfo || {};
  const roleOptions = rolesQuery.data?.roles || [];
  const selectedRole = roleOptions.find(
    (role) => String(role._id) === String(roleId),
  );

  useEffect(() => {
    if (selectedRole?.scope === "staff" && tenantId === roleTarget?._id)
      setValue("tenantId", "", { shouldValidate: true });
  }, [selectedRole?.scope, roleId, tenantId, roleTarget?._id, setValue]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const handleDelete = async (account: User) => {
    if (!window.confirm(`Soft-delete ${account.userName}'s account?`)) return;
    try {
      await deleteMutation.mutateAsync(account._id);
    } catch (error) {
      window.alert(errorMessage(error) || "Could not delete this account.");
    }
  };

  const openRoleDialog = (account: User) => {
    setRoleTarget(account);
    reset({ roleId: account.roleId, tenantId: account.tenantId || "" });
    setRoleError("");
  };

  const saveRole = handleSubmit(async (values) => {
    if (!roleTarget) return;
    setRoleError("");
    if (!selectedRole) return setRoleError("Choose a role.");
    if (selectedRole.scope === "staff" && !tenantId)
      return setRoleError("Choose the tenant supervisor for this user.");
    try {
      await roleMutation.mutateAsync({
        id: roleTarget._id,
        values: {
          roleId: values.roleId,
          tenantId: selectedRole.scope === "staff" ? values.tenantId : "",
        },
      });
      setRoleTarget(null);
    } catch (error) {
      setRoleError(errorMessage(error) || "Could not change this user's role.");
    }
  });

  const columns: GridColumns<(typeof rows)[number]> = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      valueGetter: (params) =>
        [params.row.firstName, params.row.lastName].filter(Boolean).join(" ") ||
        params.row.userName,
    },
    { field: "userName", headerName: "User name", flex: 0.8, minWidth: 130 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "roleName", headerName: "Role", flex: 0.8, minWidth: 130 },
    { field: "scope", headerName: "Account type", flex: 0.65, minWidth: 120 },
    ...(canViewBank
      ? [{ field: "bankName", headerName: "Bank", flex: 0.7, minWidth: 120 }]
      : []),
    {
      field: "status",
      headerName: "Status",
      flex: 0.65,
      minWidth: 120,
      renderCell: (params) =>
        canChangeStatus ? (
          <Select
            size="small"
            value={params.row.status}
            disabled={statusMutation.isPending}
            onChange={(event) =>
              statusMutation.mutate({
                id: params.row.id,
                status: accountStatusSchema.parse(event.target.value),
              })
            }
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        ) : (
          params.row.status
        ),
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
          <Link to={`/users/${params.row.id}`} aria-label="View user">
            <Button size="small" aria-label="View">
              <ViewIcon fontSize="small" />
            </Button>
          </Link>
          {canUpdate && (
            <Link to={`/users/${params.row.id}/edit`} aria-label="Edit user">
              <Button size="small" aria-label="Edit">
                <EditIcon fontSize="small" />
              </Button>
            </Link>
          )}
          {isPlatform &&
            hasPermission("users.assignRole") &&
            params.row.scope !== "platform" && (
              <Button size="small" onClick={() => openRoleDialog(params.row)}>
                Role
              </Button>
            )}
          {params.row.scope !== "platform" &&
            params.row.id !== user?.id &&
            hasPermission(
              params.row.scope === "staff" ? "payroll.read" : "salaries.read",
            ) && (
              <Link
                to={`/employee-payments?scope=${params.row.scope}&employeeId=${params.row.id}`}
              >
                <Button size="small">Payments</Button>
              </Link>
            )}
          {hasPermission("jobs.assigned.read") && (
            <Link
              to={`/users/${params.row.id}/jobs`}
              aria-label="View assigned jobs"
            >
              <Button size="small" aria-label="Assigned jobs">
                <WorkHistoryIcon fontSize="small" />
              </Button>
            </Link>
          )}
          {canDelete && String(user?.id) !== String(params.row.id) && (
            <Button
              size="small"
              color="error"
              aria-label="Delete user"
              onClick={() => handleDelete(params.row)}
            >
              <DeleteIcon fontSize="small" />
            </Button>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Box sx={pageHeaderRowSx}>
        <Header
          title="Users"
          subtitle="One account directory for administrators, supervisors, and staff."
        />
        {canCreate && (
          <Link to="/users/new" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={actionButtonSx}
            >
              Create user
            </Button>
          </Link>
        )}
      </Box>
      {isPlatform && (
        <Tabs
          value={scope}
          onChange={(_event, value: string) => {
            setScope(value);
            setPage(0);
          }}
          sx={{ mb: 2 }}
        >
          <Tab value="" label="All Users" />
          <Tab value="tenant" label="Supervisors" />
          <Tab value="staff" label="Staff" />
        </Tabs>
      )}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        {!isPlatform && (
          <Box sx={{ color: "text.secondary", fontSize: 14 }}>
            All users in your tenant
          </Box>
        )}
        <TextField
          size="small"
          label="Search users"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 250 }}
        />
        {statusMutation.isError && (
          <Alert severity="error">
            {errorMessage(statusMutation.error) || "Status update failed."}
          </Alert>
        )}
        {deleteMutation.isError && (
          <Alert severity="error">
            {errorMessage(deleteMutation.error) || "Delete failed."}
          </Alert>
        )}
      </Box>
      {usersQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(usersQuery.error) || "Could not load users."}
        </Alert>
      )}
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
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(0);
          }}
          components={{ Toolbar: GridToolbar }}
          disableSelectionOnClick
        />
      </Box>
      <Dialog
        open={Boolean(roleTarget)}
        onClose={() => !roleMutation.isPending && setRoleTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveRole} noValidate>
          <DialogTitle>Change user role</DialogTitle>
          <DialogContent
            sx={{ display: "grid", gap: 2, pt: "12px !important" }}
          >
            {roleError && <Alert severity="error">{roleError}</Alert>}
            {rolesQuery.isError && (
              <Alert severity="error">
                {errorMessage(rolesQuery.error) || "Could not load roles."}
              </Alert>
            )}
            <FormControl fullWidth>
              <FormField control={control} name="roleId" label="Role" select>
                {roleOptions.map((role) => (
                  <MenuItem key={role._id} value={role._id}>
                    {role.name} ({role.scope})
                  </MenuItem>
                ))}
              </FormField>
            </FormControl>
            {selectedRole?.scope === "staff" && (
              <FormControl fullWidth>
                <FormField
                  control={control}
                  name="tenantId"
                  label="Supervisor"
                  select
                >
                  {(supervisorsQuery.data?.users || [])
                    .filter(
                      (supervisor) =>
                        String(supervisor._id) !== String(roleTarget?._id),
                    )
                    .map((supervisor) => (
                      <MenuItem key={supervisor._id} value={supervisor._id}>
                        {[supervisor.firstName, supervisor.lastName]
                          .filter(Boolean)
                          .join(" ") || supervisor.userName}
                      </MenuItem>
                    ))}
                </FormField>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setRoleTarget(null)}
              disabled={roleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                roleMutation.isPending || rolesQuery.isPending || !selectedRole
              }
            >
              Save role
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
