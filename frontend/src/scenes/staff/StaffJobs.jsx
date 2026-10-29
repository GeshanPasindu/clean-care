import { getAccessToken } from "../../auth/apiClient";
import { Box, Button, MenuItem, Select, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";

const StaffJobs = () => {
  const { id } = useParams();
  const [jobs, setJobs] = useState([]);
  const [staffName, setStaffName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalPayments, setTotalPayments] = useState(0);

  const token = getAccessToken();

  useEffect(() => {
    let active = true;
    const loadStaffName = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(environment.apiUrl + `/staff/getStaffById/${id}`, { headers });
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
  }, [id, token]);

  useEffect(() => {
    fetchStaffJobs();
  }, [id]);

  const fetchStaffJobs = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let url = environment.apiUrl + `/job/getStaffJobsbyId/${id}`
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await axios.get(url, { headers });
      const responseData = response.data;
      if (responseData.success) {
        setJobs(responseData.jobs);
        calculateTotalPayments(responseData.jobs);
      } else {
        console.error("Failed to fetch staff jobs:", responseData.message);
      }
    } catch (error) {
      console.error("Error fetching staff jobs:", error);
    }
  };

  const calculateTotalPayments = (jobs) => {
    const total = jobs.reduce((sum, job) => sum + Number(job.staffAssignment?.payment || 0), 0);
    setTotalPayments(total);
  };

  const handlePaymentStatusChange = async (jobId, staffId, status) => {
    try {
      const response = await axios.put(environment.apiUrl + `/job/paymentJob`, { jobId, staffId, paymentStatus: status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseData = response.data;
      if (responseData.success) {
        fetchStaffJobs(); // Refresh jobs after updating payment status
        Swal.fire("Success", "Payment status updated successfully", "success");
      } else {
        console.error("Failed to update payment status:", responseData.message);
      }
    } catch (error) {
      console.error("Error updating payment status:", error);
    }
  };

  const handleViewJobs = () => {
    fetchStaffJobs();
  };

  const columns = [
    { field: "jobName", headerName: "Job Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 2 },
    { field: "jobStatus", headerName: "Status", flex: 1 },
    { field: "staffAssignment.signInTime", headerName: "Signed In", flex: 1, valueGetter: (params) => params.row.staffAssignment?.signInTime ? new Date(params.row.staffAssignment.signInTime).toLocaleString() : "—" },
    { field: "staffAssignment.isSignOff", headerName: "Signed Off", flex: 1, valueGetter: (params) => params.row.staffAssignment?.isSignOff ? "Yes" : "No" },
    { field: "staffAssignment.hours", headerName: "Hours", flex: 1, valueGetter: (params) => params.row.staffAssignment?.hours ?? 0 },
    { field: "staffAssignment.hourRate", headerName: "Rate", flex: 1, valueGetter: (params) => params.row.staffAssignment?.hourRate ?? 0 },
    { field: "staffAssignment.payment", headerName: "Payment", flex: 1, valueGetter: (params) => params.row.staffAssignment?.payment ?? 0 },
    {
      field: "staffAssignment.paymentStatus",
      headerName: "Payment Status",
      flex: 1,
      renderCell: (params) => (
        <Select
          value={params.row.staffAssignment?.paymentStatus || "Pending"}
          onChange={(e) => handlePaymentStatusChange(params.row._id, id, e.target.value)}
        >
          <MenuItem value="Pending">Pending</MenuItem>
          <MenuItem value="Done">Done</MenuItem>
        </Select>
      ),
    },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Header title="Staff Jobs" subtitle={staffName ? `Jobs for ${staffName}` : ""} />
      <Box sx={{ ...filterBarSx, mt: 2.5 }}>
        <Box display="flex" alignItems="center" gap="10px">
          <Box>
            <Typography fontWeight="bold" fontSize="16px">From</Typography>
            <Box>
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
          <Button
            variant="contained"
            onClick={handleViewJobs}
            disabled={(!startDate && endDate) || (startDate && !endDate)}
          >
            View Jobs
          </Button>
        </Box>
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: "0.8rem" }}>Total payments</Typography>
          <Typography variant="h3">${totalPayments}</Typography>
        </Box>
      </Box>

      <Box sx={tableSurfaceSx}>
        <DataGrid
          rows={jobs}
          columns={columns}
          components={{ Toolbar: GridToolbar }}
          getRowId={(row) => row._id}
        />
      </Box>
    </Box>
  );
};

export default StaffJobs;
