import { getAccessToken } from "../../auth/apiClient";
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { Box, Button, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";

const ClientJobs = () => {
  const { id } = useParams();
  const [jobs, setJobs] = useState([]);
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalPayments, setTotalPayments] = useState(0);

  const token = getAccessToken();

  useEffect(() => {
    let active = true;
    const loadClientName = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(environment.apiUrl + `/client/getClientById/${id}`, { headers });
        if (active && response.data.success) {
          const { firstName, lastName } = response.data.client;
          setClientName([firstName, lastName].filter(Boolean).join(" "));
        }
      } catch (error) {
        console.error("Error fetching client details:", error);
      }
    };
    loadClientName();
    return () => { active = false; };
  }, [id, token]);

  useEffect(() => {
    fetchClientJobs();
  }, [id]);

  const fetchClientJobs = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let url = environment.apiUrl + `/job/getFilteredJobs/${id}`
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await axios.get(url, { headers });
      const responseData = response.data;
      if (responseData.success) {
        setJobs(responseData.jobs);
        console.log(jobs);
        calculateTotalPayments(responseData.jobs);
      } else {
        console.error("Failed to fetch client jobs:", responseData.message);
      }
    } catch (error) {
      console.error("Error fetching client jobs:", error);
    }
  };

  const handleViewJobs = () => {
    fetchClientJobs();
  };

  const calculateTotalPayments = (jobs) => {
    const total = jobs.reduce((sum, job) => sum + (job.payment || 0), 0);
    setTotalPayments(total);
  };

  const columns = [
    { field: "jobName", headerName: "Job Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 2 },
    { field: "jobStatus", headerName: "Status", flex: 1 },
    { field: "startTime", headerName: "Start Time", flex: 1 },
    { field: "isSignOff", headerName: "Signed Off", flex: 1, renderCell: (params) => (params.value ? "Yes" : "No") },
    { field: "noOfhours", headerName: "Hours", flex: 1 },
    { field: "hourRate", headerName: "Rate", flex: 1 },
    { field: "payment", headerName: "Payment", flex: 1 },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Header title="Client Jobs" subtitle={clientName ? `Jobs for ${clientName}` : ""} />
      <Box sx={{ ...filterBarSx, mt: 2.5 }}>
        <Box display="flex" alignItems="center" gap="10px">
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

export default ClientJobs;
