import { Box, Button, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../../components/Header";
import { filterBarSx, pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import { useClient, clientQueryKeys } from "./clientQueries";
import { jobService } from "../jobs/jobService";

const ClientJobs = () => {
  const { id } = useParams();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filters, setFilters] = useState({});
  const { data: clientResponse } = useClient(id);
  const jobsQuery = useQuery({
    queryKey: clientQueryKeys.jobs(id, filters),
    queryFn: () => jobService.getFilteredByClient(id, filters),
    enabled: Boolean(id),
  });
  const jobs = jobsQuery.data?.jobs || [];
  const clientName = [clientResponse?.client?.firstName, clientResponse?.client?.lastName]
    .filter(Boolean)
    .join(" ");
  const totalPayments = jobs.reduce((sum, job) => sum + (job.payment || 0), 0);

  const handleViewJobs = () => {
    setFilters(startDate && endDate ? { startDate, endDate } : {});
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
