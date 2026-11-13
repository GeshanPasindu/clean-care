import {
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { Box, Button, IconButton, TextField, Tooltip } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import jsPDF from "jspdf";
import "jspdf-autotable";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../../components/Header";
import { pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../../styles/uiStyles";
import { useServiceQuery } from "../../../queries/queryHelpers";
import { jobService } from "../jobService";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

const CompletedJobs = () => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const params = { page: page + 1, limit: pageSize, ...(search ? { search } : {}) };
  const { data: responseData, isPending } = useServiceQuery(
    ["jobs", "completed", params],
    () => jobService.getAllCompleted(params)
  );
  const data = (responseData?.jobs || [])
    .map((item) => ({ ...item, startTime: item.startTime ? item.startTime.split("T")[0] : "N/A", id: item._id }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const exportToPdf = () => {
    const doc = new jsPDF();
    doc.autoTable({
      head: [["Job Name", "Client", "Assigned Staff", "Start Time", "No. of Hours"]],
      body: data.map(({ jobName, client, assignedStaff, jobDate, orgNoOfhours }) => [
        jobName,
        `${client.firstName} ${client.lastName}`,
        (Array.isArray(assignedStaff) ? assignedStaff : [assignedStaff])
          .map((staff) => `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim())
          .filter(Boolean)
          .join(", "),
        jobDate,
        orgNoOfhours,
      ]),
    });
    doc.save("completed_jobs_data.pdf");
  };

  const columns = [
    { field: "jobName", headerName: "Job Name", flex: 1 },
    {
      field: "client",
      headerName: "Client",
      flex: 0.8,
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
    { field: "jobDate", headerName: "Start Time (YYYY/MM/DD)", flex: 1 },
    { field: "orgNoOfhours", headerName: "Orginal No of Hours", flex: 0.6 },
    {
      field: "Actions",
      headerName: "Actions",
      flex: 0.6,
      renderCell: (params) => (
        <Box>
          <Tooltip title="View">
            <Link to={`/jobs/viewjob/${params.row.id}`}>
              <IconButton>
                <VisibilityIcon />
              </IconButton>
            </Link>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Completed Jobs" subtitle="List of all completed jobs" />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <TextField size="small" label="Search completed jobs" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(0); }} sx={{ minWidth: 260 }} />
      </Box>
      {/* <Box display="flex" justifyContent="flex-start">
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
      <Box sx={tableSurfaceSx}>
        <DataGrid
          rows={data}
          columns={columns}
          loading={isPending}
          components={{ Toolbar: GridToolbar }}
          page={page}
          pageSize={pageSize}
          rowCount={responseData?.paginationInfo?.totalResult || 0}
          paginationMode="server"
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(0); }}
        />
      </Box>
    </Box>
  );
};

export default CompletedJobs;
