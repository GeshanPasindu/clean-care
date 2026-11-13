import { AccessTime as AccessTimeIcon, FilterAltOff as FilterAltOffIcon } from "@mui/icons-material";
import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import { useServiceQuery } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";
import { useActiveEmployees } from "../users/userQueries";
import { jobService } from "../jobs/jobService";

const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "—";

const formatHoursMinutes = (value) => {
  const numericHours = Number(value || 0);
  const totalMinutes = Number.isFinite(numericHours) ? Math.max(0, Math.round(numericHours * 60)) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

function Timesheets() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const isStaff = user?.scope === "staff";
  const isPlatform = user?.scope === "platform";
  const canAssignSupervisor = hasPermission("users.tenant.assign");
  const canReadUsers = hasPermission("users.read");
  const staffId = searchParams.get("staffId") || "";
  const supervisorId = searchParams.get("supervisorId") || "";
  const filters = {
    page: page + 1,
    limit: pageSize,
    ...(!isStaff && staffId ? { staffId } : {}),
    ...(!isStaff && supervisorId ? { supervisorId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
  const timesheetsQuery = useServiceQuery(
    ["timesheets", filters],
    () => jobService.getTimesheets(filters)
  );
  const staffQuery = useActiveEmployees({ enabled: !isStaff && canReadUsers });
  const supervisorsQuery = useServiceQuery(
    ["users", "list", { scope: "tenant", status: "active" }],
    () => userService.getAll({ scope: "tenant", status: "active" }),
    { enabled: canAssignSupervisor }
  );
  const rows = timesheetsQuery.data?.timesheets || [];
  const total = timesheetsQuery.data?.paginationInfo?.total || 0;
  const totalHours = Number(timesheetsQuery.data?.totalHours || 0);
  const staffOptions = staffQuery.data?.users || [];
  const supervisorOptions = supervisorsQuery.data?.users || [];
  const loading = timesheetsQuery.isPending;
  const error = timesheetsQuery.isError
    ? timesheetsQuery.error.message || "Could not load timesheets."
    : staffQuery.isError
      ? "Could not load staff filters."
      : supervisorsQuery.isError
        ? "Could not load supervisor filters."
        : "";

  const clearFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("staffId");
    nextParams.delete("supervisorId");
    setSearchParams(nextParams, { replace: true });
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const updateQueryFilter = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    if (key === "supervisorId") nextParams.delete("staffId");
    setSearchParams(nextParams, { replace: true });
    setPage(0);
  };

  const columns = [
    { field: "staffName", headerName: "Employee", minWidth: 160, flex: 0.8 },
    { field: "jobName", headerName: "Job", minWidth: 180, flex: 1 },
    {
      field: "signInTime",
      headerName: "Clock In",
      minWidth: 180,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    {
      field: "signOffTime",
      headerName: "Clock Out",
      minWidth: 180,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    { field: "hours", headerName: "Hours", minWidth: 110, valueFormatter: ({ value }) => formatHoursMinutes(value) },
    { field: "description", headerName: "Work Description", minWidth: 280, flex: 1.5, sortable: false },
  ];

  const selectedStaff = staffOptions.find((staff) => String(staff._id) === staffId);
  const selectedSupervisor = supervisorOptions.find((admin) => String(admin._id) === supervisorId);
  const staffMatchesSelectedSupervisor = (staff) =>
    String(staff.tenantId || "") === supervisorId;
  const subtitle = isStaff
    ? "Your recorded work sessions"
    : selectedStaff
      ? `Work sessions for ${[selectedStaff.firstName, selectedStaff.lastName].filter(Boolean).join(" ")}`
      : selectedSupervisor
        ? `Work sessions under ${[selectedSupervisor.firstName, selectedSupervisor.lastName].filter(Boolean).join(" ") || selectedSupervisor.userName}`
          : isPlatform
          ? "Work sessions across all employees"
          : "Work sessions for employees under your supervision";

  return (
    <Box sx={pageContainerSx}>
      <Header title="Timesheets" subtitle={subtitle} />
      <Box sx={{ ...filterBarSx, mt: 2.5, mb: 2, flexWrap: "wrap", gap: 2 }}>
        {canAssignSupervisor && (
          <TextField
            select
            label="Supervisor"
            value={supervisorId}
            onChange={(event) => updateQueryFilter("supervisorId", event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All supervisors</MenuItem>
            {supervisorOptions.map((admin) => (
              <MenuItem key={admin._id} value={admin._id}>
                {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.userName}
              </MenuItem>
            ))}
          </TextField>
        )}
        {!isStaff && canReadUsers && (
          <TextField
            select
            label="Employee"
            value={staffId}
            onChange={(event) => updateQueryFilter("staffId", event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All employees in scope</MenuItem>
            {staffOptions
              .filter((staff) => !isPlatform || !supervisorId || staffMatchesSelectedSupervisor(staff))
              .map((staff) => (
              <MenuItem key={staff._id} value={staff._id}>
                {[staff.firstName, staff.lastName].filter(Boolean).join(" ")}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          label="From"
          type="date"
          value={startDate}
          onChange={(event) => { setStartDate(event.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To"
          type="date"
          value={endDate}
          onChange={(event) => { setEndDate(event.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
        />
        <Button startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
          Clear filters
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
          <AccessTimeIcon color="action" />
          <Typography color="text.secondary">{total} sessions · {formatHoursMinutes(totalHours)} total time</Typography>
        </Box>
      </Box>
      {error && <Typography color="error" sx={{ mb: 1.5 }}>{error}</Typography>}
      <Box sx={tableSurfaceSx}>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          loading={loading}
          components={{ Toolbar: GridToolbar }}
          page={page}
          pageSize={pageSize}
          rowCount={total}
          paginationMode="server"
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(0); }}
          disableSelectionOnClick
        />
      </Box>
    </Box>
  );
}

export default Timesheets;
