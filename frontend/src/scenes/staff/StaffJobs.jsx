import { getAccessToken } from "../../auth/apiClient";
import { Box, Button, TextField, Typography } from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { environment } from "../../environment";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import StaffPayoutReceiptDialog from "./StaffPayoutReceiptDialog";
import StaffPayrollSection from "./StaffPayrollSection";

const StaffJobs = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isStaffView = user?.role === "staff";
  const token = getAccessToken();
  const [jobs, setJobs] = useState([]);
  const [staffName, setStaffName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalPayments, setTotalPayments] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (isStaffView) {
      setStaffName(user?.userName || "Staff member");
      return undefined;
    }

    let active = true;
    const loadStaffName = async () => {
      try {
        const response = await axios.get(`${environment.apiUrl}/staff/getStaffById/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active && response.data.success) {
          const { firstName, lastName } = response.data.staff;
          setStaffName([firstName, lastName].filter(Boolean).join(" "));
        }
      } catch (error) {
        console.error("Error fetching staff details:", error);
      }
    };
    loadStaffName();
    return () => { active = false; };
  }, [id, isStaffView, token, user?.userName]);

  const calculateTotalPayments = useCallback((rows) => {
    const total = rows.reduce((sum, job) => sum + Number(job.staffAssignment?.payment || 0), 0);
    setTotalPayments(total);
  }, []);

  const fetchStaffJobs = useCallback(async () => {
    try {
      const path = isStaffView
        ? `/job/getJobsbyStaff/${user?.id || "self"}`
        : `/job/getStaffJobsbyId/${id}`;
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      }
      const query = params.toString();
      const response = await axios.get(`${environment.apiUrl}${path}${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const jobsWithAssignment = response.data.jobs.map((job) => ({
          ...job,
          staffAssignment: job.staffAssignment || job.currentStaffAssignment,
        }));
        if (isStaffView) {
          const staff = jobsWithAssignment[0]?.staffAssignment?.staff;
          setStaffName([staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || user?.userName || "Staff member");
        }
        setJobs(jobsWithAssignment);
        calculateTotalPayments(jobsWithAssignment);
      }
    } catch (error) {
      console.error("Error fetching staff jobs:", error);
    }
  }, [calculateTotalPayments, endDate, id, isStaffView, startDate, token, user?.id, user?.userName]);

  useEffect(() => {
    fetchStaffJobs();
  }, [fetchStaffJobs]);

  const handlePaymentSaved = (updatedJob) => {
    const updatedJobs = jobs.map((job) => job._id === updatedJob._id ? updatedJob : job);
    setJobs(updatedJobs);
    calculateTotalPayments(updatedJobs);
    setSelectedJob(updatedJob);
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
      <StaffPayrollSection staffId={isStaffView ? "self" : id} isStaffView={isStaffView} onSaved={fetchStaffJobs} />
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
          <Button variant="contained" onClick={fetchStaffJobs} disabled={(!startDate && endDate) || (startDate && !endDate)}>
            Filter payments
          </Button>
        </Box>
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: "0.8rem" }}>Earnings across listed jobs</Typography>
          <Typography variant="h3">LKR {totalPayments.toFixed(2)}</Typography>
        </Box>
      </Box>
      <Box sx={tableSurfaceSx}>
        <DataGrid rows={jobs} columns={columns} components={{ Toolbar: GridToolbar }} getRowId={(row) => row._id} />
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
