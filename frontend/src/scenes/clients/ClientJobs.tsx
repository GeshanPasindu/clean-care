import { Box, Button, TextField, Typography } from "@mui/material";
import type { GridColumns } from "@mui/x-data-grid";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import FormField from "../../components/forms/FormField";
import Header from "../../components/Header";
import { useDateRangeForm } from "../../hooks/useDateRangeForm";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  filterBarSx,
  pageContainerSx,
  tableSurfaceSx,
} from "../../styles/uiStyles";
import { jobService } from "../jobs/jobService";
import { clientQueryKeys, useClient } from "./clientQueries";

const ClientJobs = () => {
  const { id } = useParams();
  const {
    control: rangeControl,
    handleSubmit: submitRange,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
  } = useDateRangeForm();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const queryParams = {
    ...filters,
    page: page + 1,
    limit: pageSize,
    ...(search ? { search } : {}),
  };
  const { data: clientResponse } = useClient(id);
  const jobsQuery = useQuery({
    queryKey: clientQueryKeys.jobs(id, queryParams),
    queryFn: () => jobService.getFilteredByClient(id, queryParams),
    enabled: Boolean(id),
  });
  const jobs = jobsQuery.data?.jobs || [];
  const clientName = [
    clientResponse?.client?.firstName,
    clientResponse?.client?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const totalPayments = Number(jobsQuery.data?.totalPayment || 0);

  const handleViewJobs = submitRange(() => {
    setFilters(startDate && endDate ? { startDate, endDate } : {});
    setPage(0);
  });

  const columns: GridColumns<(typeof jobs)[number]> = [
    { field: "jobName", headerName: "Job Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 2 },
    { field: "jobStatus", headerName: "Status", flex: 1 },
    { field: "startTime", headerName: "Start Time", flex: 1 },
    {
      field: "isSignOff",
      headerName: "Signed Off",
      flex: 1,
      renderCell: (params) => (params.value ? "Yes" : "No"),
    },
    { field: "noOfhours", headerName: "Hours", flex: 1 },
    { field: "hourRate", headerName: "Rate", flex: 1 },
    { field: "payment", headerName: "Payment", flex: 1 },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Header
        title="Client Jobs"
        subtitle={clientName ? `Jobs for ${clientName}` : ""}
      />
      <Box sx={{ ...filterBarSx, mt: 2.5 }}>
        <Box display="flex" alignItems="center" gap="10px">
          <Box>
            <Typography fontWeight="bold" fontSize="16px">
              From
            </Typography>
            <Box>
              <FormField
                control={rangeControl}
                name="startDate"
                fullWidth
                variant="outlined"
                type="date"
              />
            </Box>
          </Box>
          <Box>
            <Typography fontWeight="bold" fontSize="16px">
              To
            </Typography>
            <Box>
              <FormField
                control={rangeControl}
                name="endDate"
                fullWidth
                variant="outlined"
                type="date"
              />
            </Box>
          </Box>
          <Button
            variant="contained"
            onClick={() => void handleViewJobs()}
            disabled={Boolean(
              (!startDate && endDate) || (startDate && !endDate),
            )}
          >
            View Jobs
          </Button>
        </Box>
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: "0.8rem" }}>
            Total payments
          </Typography>
          <Typography variant="h3">${totalPayments}</Typography>
        </Box>
      </Box>

      <Box sx={tableSurfaceSx}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2, pt: 2 }}>
          <TextField
            size="small"
            label="Search jobs"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 250 }}
          />
        </Box>
        <DataGrid
          rows={jobs}
          columns={columns}
          loading={jobsQuery.isPending}
          components={{ Toolbar: GridToolbar }}
          getRowId={(row) => row._id}
          page={page}
          pageSize={pageSize}
          rowCount={jobsQuery.data?.paginationInfo?.totalResult || 0}
          paginationMode="server"
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(0);
          }}
        />
      </Box>
    </Box>
  );
};

export default ClientJobs;
