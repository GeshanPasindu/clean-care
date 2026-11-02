import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { useServiceQuery } from "../../queries/queryHelpers";
import { staffService } from "../../services/staffService";
import { jobService } from "../jobs/jobService";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import StaffPayoutReceiptDialog from "./StaffPayoutReceiptDialog";
import StaffPayrollSection from "./StaffPayrollSection";

const StaffJobs = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isStaffView = user?.role === "staff";
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);

  const staffQuery = useServiceQuery(
    ["staff", "detail", id],
    () => staffService.getById(id),
    { enabled: Boolean(id) && !isStaffView }
  );
  const jobsQuery = useServiceQuery(
    ["staff-jobs", isStaffView ? user?.id || "self" : id, appliedFilters],
    () => isStaffView
      ? jobService.getByStaff(user?.id || "self", appliedFilters)
      : jobService.getStaffJobs(id, appliedFilters),
    { enabled: Boolean(isStaffView || id) }
  );
  const jobs = useMemo(
    () => (jobsQuery.data?.jobs || []).map((job) => ({
      ...job,
      staffAssignment: job.staffAssignment || job.currentStaffAssignment,
    })),
    [jobsQuery.data]
  );
  const assignmentStaff = jobs[0]?.staffAssignment?.staff;
  const staffRecord = staffQuery.data?.staff;
  const staffName = isStaffView
    ? [assignmentStaff?.firstName, assignmentStaff?.lastName].filter(Boolean).join(" ") || user?.userName || "Staff member"
    : [staffRecord?.firstName, staffRecord?.lastName].filter(Boolean).join(" ");
  const totalPayments = jobs.reduce((sum, job) => sum + Number(job.staffAssignment?.payment || 0), 0);

  const handlePaymentSaved = (updatedJob) => {
    setSelectedJob(updatedJob);
  };

  const handleFilter = () => {
    setAppliedFilters(startDate && endDate ? { startDate, endDate } : {});
  };

  const columns = [
    { field: "jobName", headerName: "Job Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 1.5 },
    { field: "jobStatus", headerName: "Job Status", flex: 0.8 },
    {
      field: "signedIn",
      headerName: "Signed In",
      flex: 1,
      valueGetter: (params) => params.row.staffAssignment?.signInTime ? new Date(params.row.staffAssignment.signInTime).toLocaleString() : "Not signed in",
    },
    {
      field: "hours",
      headerName: "Hours",
      flex: 0.55,
      valueGetter: (params) => Number(params.row.staffAssignment?.hours || 0).toFixed(2),
    },
    {
      field: "rate",
      headerName: "Rate (LKR)",
      flex: 0.65,
      valueGetter: (params) => Number(params.row.staffAssignment?.hourRate || 0).toFixed(2),
    },
    {
      field: "payment",
      headerName: "Earnings (LKR)",
      flex: 0.8,
      valueGetter: (params) => Number(params.row.staffAssignment?.payment || 0).toFixed(2),
    },
    {
      field: "paymentStatus",
      headerName: "Payment Status",
      flex: 0.8,
      valueGetter: (params) => params.row.staffAssignment?.paymentStatus === "Done" ? "Paid" : "Pending",
    },
    {
      field: "payoutReceipts",
      headerName: "Job Receipts",
      flex: 0.8,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button size="small" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => setSelectedJob(params.row)}>
          Receipts
        </Button>
      ),
    },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Header
        title={isStaffView ? "My Payments" : "Staff Payments"}
        subtitle={isStaffView ? "Your payout history" : staffName ? `Payouts for ${staffName}` : ""}
      />
      <StaffPayrollSection staffId={isStaffView ? "self" : id} isStaffView={isStaffView} onSaved={() => jobsQuery.refetch()} />
      <Box sx={{ ...filterBarSx, mt: 2.5 }}>
        <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
          <Box>
            <Typography fontWeight="bold" fontSize="16px">From</Typography>
            <TextField fullWidth variant="outlined" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Box>
          <Box>
            <Typography fontWeight="bold" fontSize="16px">To</Typography>
            <TextField fullWidth variant="outlined" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Box>
          <Button variant="contained" onClick={handleFilter} disabled={(!startDate && endDate) || (startDate && !endDate)}>
            Filter payments
          </Button>
        </Box>
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: "0.8rem" }}>Earnings across listed jobs</Typography>
          <Typography variant="h3">LKR {totalPayments.toFixed(2)}</Typography>
        </Box>
      </Box>
      {jobsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>{jobsQuery.error.message || "Could not load staff payments."}</Alert>}
      <Box sx={tableSurfaceSx}>
        <DataGrid rows={jobs} columns={columns} components={{ Toolbar: GridToolbar }} getRowId={(row) => row._id} loading={jobsQuery.isPending} />
      </Box>
      <StaffPayoutReceiptDialog
        open={Boolean(selectedJob)}
        job={selectedJob}
        assignment={selectedJob?.staffAssignment}
        staffName={staffName}
        canRecord={false}
        onClose={() => setSelectedJob(null)}
        onPaymentSaved={handlePaymentSaved}
      />
    </Box>
  );
};

export default StaffJobs;
