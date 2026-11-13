import {
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
  } from "@mui/icons-material";
  import EditIcon from "@mui/icons-material/Edit";
  import {
    Box,
    Button,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    Typography,
    TextField,
    Paper,
  } from "@mui/material";
  import { DataGrid, GridToolbar } from "@mui/x-data-grid";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  import React, { useEffect, useState } from "react";
  import { Link } from "react-router-dom";
  import Swal from "sweetalert2";
  import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
  import { actionButtonSx, filterBarSx, pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../styles/uiStyles";
  import { useQuery } from "@tanstack/react-query";
  import { useClients } from "../clients/clientQueries";
  import { useActiveEmployees } from "../users/userQueries";
  import { jobService } from "./jobService";
  import { useServiceMutation } from "../../queries/queryHelpers";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";


  const Jobs = () => {
    const { user, hasPermission } = useAuth();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [selectedStaff, setSelectedStaff] = useState("");
    const [selectedClient, setSelectedClient] = useState("");
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [searchInput, setSearchInput] = useState("");
    const search = useDebouncedValue(searchInput.trim());
    const queryParams = { ...filters, page: page + 1, limit: pageSize, ...(search ? { search } : {}) };


    
    
  
    const canCreateJobs = hasPermission("jobs.create");
    const canUpdateJobs = hasPermission("jobs.update");
    const canDeleteJobs = hasPermission("jobs.delete");
    const canUpdateStatus = hasPermission("jobs.status.update");
    const canReadFinancials = hasPermission("jobs.financials.read");
    const canReadUsers = hasPermission("users.read");
    const canReadClients = hasPermission("clients.read");
    const userStaff = user?.scope === "staff";
  
    const userId = user?.id;
    const jobsQuery = useQuery({
      queryKey: ["jobs", "list", user?.scope, userId, queryParams],
      queryFn: () => jobService.getAll(queryParams),
      enabled: Boolean(user?.scope && hasPermission("jobs.read")),
    });
    const activeJobQuery = useQuery({
      queryKey: ["jobs", "staff-active", userId],
      queryFn: () => jobService.getByStaff(userId || "self"),
      enabled: userStaff,
    });
    const { data: staffResponse } = useActiveEmployees({ enabled: canReadUsers });
    const { data: clientResponse } = useClients({ enabled: canReadClients });
    const changeJobStatus = useServiceMutation(
      ({ id, status }) => jobService.updateStatus(id, { jobStatus: status }),
      { invalidate: [["jobs"]] }
    );
    const deleteJob = useServiceMutation(jobService.remove, { invalidate: [["jobs"]] });
    const updateAttendance = useServiceMutation(
      ({ action, id, body }) => jobService.updateAction(action, id, body),
      { invalidate: [["jobs"]] }
    );
    const attendanceUpdating = updateAttendance.isPending;
    const staff = (staffResponse?.users || []).map((item) => ({ ...item, id: item._id }));
    const clients = (clientResponse?.clients || []).map((item) => ({ ...item, id: item._id }));
    const data = (jobsQuery.data?.jobs || [])
      .map((item) => ({ ...item, id: item._id, jobDate: formatTime(item.jobDate) }));
    const activeJob = (activeJobQuery.data?.jobs || []).find((job) =>
      job.currentStaffAssignment?.isSignIn && !job.currentStaffAssignment?.isSignOff
    ) || null;
    function formatTime(dateTime) {
      if (!dateTime) return null;
      const time = new Date(dateTime);
      return time.toLocaleTimeString("en-CA", { day:'2-digit',month:'2-digit',year:'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',hour12: false, });
    }

    const formatElapsedTime = (startTime, now) => {
      const start = new Date(startTime).getTime();
      if (!Number.isFinite(start)) return "00:00:00";
      const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
    };

    const activeJobId = activeJob?._id;
    useEffect(() => {
      if (!activeJobId) return undefined;
      const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
      return () => window.clearInterval(timer);
    }, [activeJobId]);
  
    const exportToPdf = () => {
      const doc = new jsPDF();
      doc.autoTable({
        head: [["Job Name", "Client", "Assigned Staff", "Start Time"]],
        body: data.map(({ jobName, client, assignedStaff, startTime }) => [
          jobName,
          `${client.firstName} ${client.lastName} `,
          (Array.isArray(assignedStaff) ? assignedStaff : [assignedStaff])
            .map((staff) => `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", "),
          startTime,
        ]),
      });
      doc.save("jobs_data.pdf");
    };
  
    const handleStatusChange = async (id, newStatus) => {
      try {
        await changeJobStatus.mutateAsync({ id, status: newStatus });
        Swal.fire("Updated!", "Job status has been updated.", "success");
      } catch (error) {
        console.error("Error updating job status:", error);
        Swal.fire("Error!", "Failed to update job status. Please try again later.", "error");
      }
    };

    const handleAttendanceToggle = async (job) => {
      const assignment = job?.currentStaffAssignment || {};
      const isSignedIn = !!assignment.isSignIn && !assignment.isSignOff;
      const jobId = job?._id || job?.id;
      if (!jobId) return;

      let body = {};
      if (isSignedIn) {
        const result = await Swal.fire({
          title: "Describe the work completed",
          input: "textarea",
          inputPlaceholder: "Add a short description of the work...",
          inputAttributes: { maxlength: "1000", "aria-label": "Work description" },
          inputValidator: (value) => !value?.trim() ? "Enter a work description before signing out." : undefined,
          showCancelButton: true,
          confirmButtonText: "Save and sign out",
          cancelButtonText: "Keep working",
        });
        if (!result.isConfirmed) return;
        body = { description: result.value.trim() };
      }

      try {
        const action = isSignedIn ? "signOffJob" : "signInJob";
        const response = await updateAttendance.mutateAsync({ action, id: jobId, body });
        if (!response.success) throw new Error(response.message || "Attendance update failed");
        await Promise.all([jobsQuery.refetch(), activeJobQuery.refetch()]);
        Swal.fire("Updated", `You have been signed ${isSignedIn ? "out" : "in"}.`, "success");
      } catch (error) {
        Swal.fire("Error", error.message || "Could not update attendance.", "error");
      }
    };
  
    const handleDeleteClick = (id) => {
      Swal.fire({
        title: "Are you sure?",
        text: "Once deleted, you will not be able to recover this job!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Delete",
      }).then((result) => {
        if (result.isConfirmed) {
          deleteJob.mutate(id, {
            onSuccess: () => Swal.fire("Deleted!", "The job has been deleted.", "success"),
            onError: (error) => {
              console.error("Error deleting job:", error);
              Swal.fire("Error!", "Failed to delete job. Please try again later.", "error");
            },
          });
        }
      });
    };
  
    const handleEditClick = (id) => { };

    const handleViewJobs = () => {
      setFilters({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(selectedStaff ? { staffId: selectedStaff } : {}),
        ...(selectedClient ? { clientId: selectedClient } : {}),
      });
      setPage(0);
    };

    const vievAlljobs = () =>{
      setEndDate('');
      setStartDate('');
      setSelectedClient('')
      setSelectedStaff('');
      setFilters({});
      setPage(0);
    }

  let columns =[]
     columns = [
      { field: "jobName", headerName: "Job Name", flex: 0.5 },
      {
        field: "client",
        headerName: "Client",
        flex: 0.7,
        renderCell: (params) =>
          `${params.row.client.firstName} ${params.row.client.lastName}`,
      },
      {
        field: "assignedStaff",
        headerName: "Assigned Staff",
        flex: 0.8,
        renderCell: (params) =>
          (Array.isArray(params.row.assignedStaff) ? params.row.assignedStaff : [params.row.assignedStaff])
            .map((staff) => `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", "),
      },
      {
        field: "jobDate",
        headerName: "Job Date",
        flex: 0.5,
      },
      // {
      //   field: "orgNoOfhours",
      //   headerName: "Original No Hours",
      //   flex: 0.5,
      // },
      {
        field: "estNoOfhours",
        headerName: "Estimate No Hours",
        flex: 0.3,
      },
      // {
      //   field: "orgTotal",
      //   headerName: "Total Payment",
      //   flex: 0.5,
      // },
      {
        field: "jobStatus",
        headerName: "Status",
        flex: 0.6,
        renderCell: (params) => canUpdateStatus ? (
          <Select
            value={params.row.jobStatus}
            onChange={(e) => handleStatusChange(params.row.id,e.target.value)}
          >
            <MenuItem value="InProgress">In Progress</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
            <MenuItem value="Cancelled">Cancelled</MenuItem>
          </Select>
        ) : params.row.jobStatus,
      },
      {
        field: "Actions",
        headerName: "Actions",
        flex: 0.6,
        renderCell: (params) => (
          <Box>{canUpdateJobs &&
            <Tooltip title="Edit">
              <Link to={`/jobs/editjob/${params.row.id}`}>
                <IconButton>
                  <EditIcon
                    onClick={() =>
                      handleEditClick(params.row.id, params.row.role)
                    }
                  />
                </IconButton>
              </Link>
            </Tooltip>
            }
            
            <Tooltip title="View">
              <Link to={`/jobs/viewjob/${params.row.id}`}>
                <IconButton>
                  <VisibilityIcon />
                </IconButton>
              </Link>
            </Tooltip>
            {canDeleteJobs &&
            <Tooltip title="Delete">
            <IconButton onClick={() => handleDeleteClick(params.row.id)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>}
            
          </Box>
        ),
      },
    ];

    if (userStaff) {
      columns.splice(columns.length - 1, 0, {
        field: "attendance",
        headerName: "Attendance",
        flex: 0.7,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const assignment = params.row.currentStaffAssignment || {};
          const isSignedIn = !!assignment.isSignIn && !assignment.isSignOff;
          const signInDisabled = !isSignedIn && (
            params.row.jobStatus !== "InProgress" || Boolean(activeJob)
          );
          return (
            <Tooltip title={signInDisabled && activeJob ? "Sign out of your current task before starting another." : ""}>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  color={isSignedIn ? "error" : "success"}
                  disabled={attendanceUpdating || signInDisabled}
                  onClick={() => handleAttendanceToggle(params.row)}
                >
                  {isSignedIn ? "Sign Out" : "Sign In"}
                </Button>
              </span>
            </Tooltip>
          );
        },
      });
    }

    if (canReadFinancials) {
      columns.splice(6, 0, { field: "orgNoOfhours", headerName: "Original No Hours", flex: 0.4 });
      columns.splice(7, 0, { field: "orgTotal", headerName: "Total Payment", flex: 0.4 });
      columns.splice(8, 0, { field: "staffPayTotal", headerName: "Staff Payment", flex: 0.5 });
    }
   
  
    return (
      <Box sx={pageContainerSx}>
        <Box sx={pageHeaderRowSx}>
          <Header title="Jobs Management" subtitle="Managing the jobs" />
          {canCreateJobs && (
            <Box>
              <Link to={"/jobs/newjob"} style={{ textDecoration: "none" }}>
                <Button
                  variant="contained"
                  sx={actionButtonSx}
                >
                  Add a Job
                </Button>
              </Link>
            </Box>
          )}
        </Box>
        {userStaff && (
          <Paper
            variant="outlined"
            sx={{
              mb: 2.5,
              p: 2.5,
              borderWidth: 2,
              borderColor: "success.main",
              borderRadius: 3,
              backgroundColor: "rgba(46, 125, 50, 0.045)",
            }}
          >
            {activeJob?.currentStaffAssignment?.isSignIn && !activeJob?.currentStaffAssignment?.isSignOff ? (
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                  <Typography variant="overline" color="success.dark" fontWeight={700}>Current task</Typography>
                  <Typography variant="h6" fontWeight={700}>{activeJob.jobName}</Typography>
                  <Typography color="text.secondary">
                    {[activeJob.client?.firstName, activeJob.client?.lastName].filter(Boolean).join(" ")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Signed in at {activeJob.currentStaffAssignment.signInTime ? new Date(activeJob.currentStaffAssignment.signInTime).toLocaleTimeString() : "—"}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <Box>
                    <Typography variant="caption" color="text.secondary">Time spent</Typography>
                    <Typography variant="h4" color="success.dark" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatElapsedTime(activeJob.currentStaffAssignment.signInTime, currentTime)}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={attendanceUpdating}
                    onClick={() => handleAttendanceToggle(activeJob)}
                  >
                    Sign Out
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" color="success.dark" fontWeight={700}>No active task</Typography>
                <Typography color="text.secondary">Choose an in-progress task below and sign in to start tracking your work time.</Typography>
              </Box>
            )}
          </Paper>
        )}
        {/* <Box
          display="flex"
          justifyContent="flex-start"
          marginTop="10px"
          marginBottom="20px"
        >
          <Button
            variant="contained"
            onClick={exportToPdf}
            sx={{
              backgroundColor: "#4caf50",
              color: "white",
              fontSize: "10px",
              "&:hover": {
                backgroundColor: "#388e3c",
              },
            }}
          >
            Export as PDF
          </Button>
        </Box> */}
        
<Box sx={filterBarSx}>
  <Box>
    <Typography fontWeight="bold" fontSize="16px">From</Typography>
    <Box >
      <TextField
        fullWidth
        variant="outlined"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        name="startTime"
      />
    </Box>
  </Box>
  <Box>
    <Typography fontWeight="bold" fontSize="16px">To</Typography>
    <Box>
      <TextField
        fullWidth
        variant="outlined"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        name="endTime"
      />
    </Box>
  </Box>
  {(canReadUsers || canReadClients) && (
    <Box  display="flex" justifyContent="flex-start" alignItems="center" gap="10px">
      {canReadUsers && <Box>
        <Typography fontWeight="bold" fontSize="16px">Staff</Typography>
        <Select
          fullWidth
          style={{minWidth:'100px'}}
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          placeholder="Select Staff"
        >
          {staff.map((staff) => (
            <MenuItem key={staff.id} value={staff.id}>{staff.firstName} {staff.lastName}</MenuItem>
          ))}
        </Select>
      </Box>}
      {canReadClients && <Box>
        <Typography fontWeight="bold" fontSize="16px">Client</Typography>
        <Select
          fullWidth
          style={{minWidth:'100px'}}
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          placeholder="Select Client"
        >
          {clients.map((client) => (
            <MenuItem key={client.id} value={client.id}>{client.firstName} {client.lastName}</MenuItem>
          ))}
        </Select>
      </Box>}
    </Box>
  )}
  <Button
    variant="contained"
    onClick={handleViewJobs}
    disabled={Boolean(startDate) !== Boolean(endDate)}
  >
    Filter jobs
  </Button>
  <Button
    variant="outlined"
    onClick={vievAlljobs}
  >
    View all
  </Button>
  {/* <Button
    variant="contained"
    onClick={exportToPdf}
    sx={{
      backgroundColor: "#4caf50",
      color: "white",
      fontSize: "10px",
      "&:hover": {
        backgroundColor: "#388e3c",
      },
    }}
  >
    Export as PDF
  </Button> */}
</Box>

        <Box sx={tableSurfaceSx}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2, pt: 2 }}>
            <TextField size="small" label="Search jobs" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(0); }} sx={{ minWidth: 250 }} />
          </Box>
          <DataGrid
            rows={data}
            columns={columns}
            loading={jobsQuery.isPending}
            page={page}
            pageSize={pageSize}
            rowCount={jobsQuery.data?.paginationInfo?.totalResult || 0}
            paginationMode="server"
            rowsPerPageOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(0); }}
            components={{ Toolbar: GridToolbar }}
          />
        </Box>
      </Box>
    );
  };
  
  export default Jobs;
