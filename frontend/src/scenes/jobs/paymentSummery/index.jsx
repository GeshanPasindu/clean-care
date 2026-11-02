import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { Alert, Box, Button, MenuItem, Select, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useState } from "react";
import Swal from "sweetalert2";
import Header from "../../../components/Header";
import { useAuth } from "../../../auth/AuthContext";
import { useServiceMutation, useServiceQuery } from "../../../queries/queryHelpers";
import { useClients } from "../../clients/clientQueries";
import { useStaff } from "../../staff/staffQueries";
import { filterBarSx, pageContainerSx, pageHeaderRowSx, surfaceSx, tableSurfaceSx } from "../../../styles/uiStyles";
import { jobService } from "../jobService";
import PaymentReceiptDialog from "./PaymentReceiptDialog";


  const Jobs = () => {
    const { user } = useAuth();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedStaff, setSelectedStaff] = useState("");
    const [selectedClient, setSelectedClient] = useState("");
    const [filters, setFilters] = useState({});
    const [selectedJob, setSelectedJob] = useState(null);

    const userRole = user?.role;
    const shouldShowButton = Boolean(userRole && userRole !== "staff");
    const userStaff = userRole === "staff";

    const formatTime = (dateTime) => {
      if (!dateTime) return null;
      return new Date(dateTime).toLocaleTimeString("en-CA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    const jobsQuery = useServiceQuery(
      ["jobs", "payment-summary", userRole, user?.id, filters],
      () => userStaff
        ? jobService.getByStaff(user?.id || "self", filters)
        : jobService.getAllJobs(filters),
      { enabled: Boolean(userRole) }
    );
    const staffQuery = useStaff({ enabled: shouldShowButton });
    const clientsQuery = useClients({ enabled: shouldShowButton });
    const updateJobStatus = useServiceMutation(
      ({ id, status }) => jobService.updateStatus(id, { jobStatus: status }),
      { invalidate: [["jobs"]] }
    );
    const deleteJob = useServiceMutation(jobService.remove, { invalidate: [["jobs"]] });

    const staff = (staffQuery.data?.staffs || []).map((item) => ({ ...item, id: item._id }));
    const clients = (clientsQuery.data?.clients || []).map((item) => ({ ...item, id: item._id }));
    const data = (jobsQuery.data?.jobs || []).map((item) => ({
      ...item,
      id: item._id,
      jobDate: formatTime(item.jobDate),
    }));
    const totalPayment = data.reduce((sum, job) => sum + Number(job.orgTotal || 0), 0);
    const receivedPayment = data.reduce(
      (sum, job) => sum + (job.receivedPayments || []).reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0),
      0
    );
    const staffPayment = data.reduce((sum, job) => sum + Number(job.staffPayTotal || 0), 0);
    const profit = totalPayment - staffPayment;

    const handlePaymentSaved = (updatedJob) => {
      setSelectedJob(updatedJob);
    };

    const handleStatusChange = async (id, newStatus) => {
      try {
        const response = await updateJobStatus.mutateAsync({ id, status: newStatus });
        if (!response.success) throw new Error(response.message || "Job status update failed");
        Swal.fire("Updated!", "Job status has been updated.", "success");
      } catch (error) {
        console.error("Error updating job status:", error);
        Swal.fire("Error!", "Failed to update job status. Please try again later.", "error");
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

    const handleViewJobs = () => {
      setFilters({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(selectedStaff ? { staffId: selectedStaff } : {}),
        ...(selectedClient ? { clientId: selectedClient } : {}),
      });
    };

    const vievAlljobs = () => {
      setEndDate("");
      setStartDate("");
      setSelectedClient("");
      setSelectedStaff("");
      setFilters({});
    };
  let columns =[]
     columns = [
      { field: "id", headerName: "Job ID",hide: true },
      { field: "jobName", headerName: "Job Name", flex: 0.8 },
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
        flex: 0.7,
      },
      // {
      //   field: "orgNoOfhours",
      //   headerName: "Original No Hours",
      //   flex: 0.5,
      // },
      {
        field: "estNoOfhours",
        headerName: "Estimate No Hours",
        flex: 0.5,
      },
      // {
      //   field: "orgTotal",
      //   headerName: "Total Payment",
      //   flex: 0.5,
      // },
      { field: "staffPayTotal", headerName: "Staff Payment", flex: 0.5 },
      {
        field: "jobStatus",
        headerName: "Status",
        flex: 0.6,
        renderCell: (params) => (
          <Select
            value={params.row.jobStatus}
            onChange={(e) => handleStatusChange(params.row.id,e.target.value)}
          >
            <MenuItem value="InProgress">In Progress</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
            <MenuItem value="Cancelled">Cancelled</MenuItem>
          </Select>
        ),
      },
      
    ];

    if (shouldShowButton) {
      columns.splice(6, 0, { field: "orgNoOfhours", headerName: "Original No Hours", flex: 0.5 });
      columns.splice(7, 0, { field: "orgTotal", headerName: "Total Payment", flex: 0.5 });
      columns.push(
        {
          field: "receivedAmount",
          headerName: "Received",
          flex: 0.6,
          valueGetter: (params) => (params.row.receivedPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          valueFormatter: (params) => `LKR ${Number(params.value || 0).toFixed(2)}`,
        },
        {
          field: "balanceDue",
          headerName: "Balance Due",
          flex: 0.6,
          valueGetter: (params) => Math.max(0, Number(params.row.orgTotal || params.row.payment || 0) - (params.row.receivedPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
          valueFormatter: (params) => `LKR ${Number(params.value || 0).toFixed(2)}`,
        },
        {
          field: "receipts",
          headerName: "Receipts",
          flex: 0.7,
          sortable: false,
          filterable: false,
          renderCell: (params) => (
            <Button size="small" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => setSelectedJob(params.row)}>
              Receipts
            </Button>
          ),
        }
      );
    }
    if (userStaff) {
      columns.splice(5, 0, { field: "staffPayTotal", headerName: "Staff Payment", flex: 0.5 });
    }
    
  
    return (
      <Box sx={pageContainerSx}>
        <Box sx={pageHeaderRowSx}>
          <Header title="Payment Summary" subtitle="Review job revenue, receipts, staff payments, and profit" />
          
        </Box>
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
  {shouldShowButton && (
    <Box  display="flex" justifyContent="flex-start" alignItems="center" gap="10px">
      <Box>
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
      </Box>
      <Box>
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
      </Box>
    </Box>
  )}
  <Button
    variant="contained"
    onClick={handleViewJobs}
    disabled={(!startDate && endDate) || (startDate && !endDate)}
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

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>
          <Box sx={{ ...surfaceSx, p: 2 }}>
            <Typography color="text.secondary" sx={{ fontSize: "0.8rem", mb: 0.5 }}>Total billed</Typography>
            <Typography variant="h3">LKR {totalPayment.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ ...surfaceSx, p: 2 }}>
            <Typography color="text.secondary" sx={{ fontSize: "0.8rem", mb: 0.5 }}>Total received</Typography>
            <Typography variant="h3">LKR {receivedPayment.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ ...surfaceSx, p: 2 }}>
            <Typography color="text.secondary" sx={{ fontSize: "0.8rem", mb: 0.5 }}>Staff payment</Typography>
            <Typography variant="h3">LKR {staffPayment.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ ...surfaceSx, p: 2 }}>
            <Typography color="text.secondary" sx={{ fontSize: "0.8rem", mb: 0.5 }}>Profit</Typography>
            <Typography variant="h3">LKR {profit.toFixed(2)}</Typography>
          </Box>
        </Box>
        {jobsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>{jobsQuery.error.message || "Could not load payment summary."}</Alert>}
        <Box sx={tableSurfaceSx}>
          <DataGrid
            rows={data}
            columns={columns}
            components={{ Toolbar: GridToolbar }}
            loading={jobsQuery.isPending}
          />
        </Box>
        <PaymentReceiptDialog
          open={Boolean(selectedJob)}
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onPaymentSaved={handlePaymentSaved}
        />
      </Box>
    );
  };
  
  export default Jobs;
