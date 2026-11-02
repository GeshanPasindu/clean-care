import {
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
  } from "@mui/icons-material";
  import EditIcon from "@mui/icons-material/Edit";
  import { Box, Button, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from "@mui/material";
  import { DataGrid, GridToolbar } from "@mui/x-data-grid";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  import React, { useState } from "react";
  import { Link } from "react-router-dom";
  import Swal from "sweetalert2";
  import Header from "../../components/Header";
  import { useDeleteInvoice, useInvoices, useUpdateInvoiceStatus } from "./invoiceQueries";
  import { actionButtonSx, filterBarSx, pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../styles/uiStyles";
  
  const Invoices = () => {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [filters, setFilters] = useState({});
    const { data: responseData, isPending } = useInvoices(filters);
    const deleteInvoice = useDeleteInvoice();
    const updateInvoiceStatus = useUpdateInvoiceStatus();
    const data = (responseData?.invoices || [])
      .map((item) => ({
        ...item,
        id: item._id,
        clientName: [item.client?.firstName, item.client?.lastName].filter(Boolean).join(" "),
      }))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  
    const exportToPdf = () => {
      const doc = new jsPDF();
      doc.autoTable({
        head: [["Invoice ID", "Title", "Description", "Send Date", "Client Name", "Amount", "Status"]],
        body: data.map(({ _id, invoiceTitle, invoiceDescription, sendDate, clientName, amount, invoiceStatus }) => [
          _id,
          invoiceTitle,
          invoiceDescription,
          new Date(sendDate).toLocaleDateString(),
          clientName,
          amount,
          invoiceStatus,
        ]),
      });
      doc.save("invoices_data.pdf");
    };
  
    const handleDeleteClick = (id) => {
      Swal.fire({
        title: "Are you sure?",
        text: "Once deleted, you will not be able to recover this invoice!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Delete",
      }).then((result) => {
        if (result.isConfirmed) {
          deleteInvoice.mutate(id, {
            onSuccess: () => Swal.fire("Deleted!", "The invoice has been deleted.", "success"),
            onError: (error) => {
              console.error("Error deleting invoice:", error);
              Swal.fire("Error!", "Failed to delete invoice. Please try again later.", "error");
            },
          });
        }
      });
    };
  
    const handleEditClick = (id) => {
      // Implement the edit functionality
    };
  
    const handleStatusChange = (id, newStatus) => {
        Swal.fire({
          title: "Are you sure?",
          text: "Do you want to change the status of this client?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Yes, change it!",
        }).then((result) => {
          if (result.isConfirmed) {
            updateInvoiceStatus.mutate(
              { id, status: newStatus },
              {
                onSuccess: () => Swal.fire("Updated!", "The invoice status has been updated.", "success"),
                onError: (error) => {
                  console.error("Error updating invoice status:", error);
                  Swal.fire("Error!", "Failed to update invoice status. Please try again later.", "error");
                },
              }
            );
          }
        });
      };
      const handleViewInvoices = () => {
        setFilters(startDate && endDate ? { startDate, endDate } : {});
      };
    const columns = [
      { field: "id", headerName: "Invoice ID", flex: 1 },
      { field: "invoiceTitle", headerName: "Title", flex: 0.6 },
      { field: "invoiceDescription", headerName: "Description", flex: 0.8 },
      { field: "sendDate", headerName: "Send Date", flex: 0.6, renderCell: (params) => new Date(params.value).toLocaleDateString() },
      { field: "clientName", headerName: "Client Name", flex: 0.8 },
      { field: "amount", headerName: "Amount", flex: 0.6 },
      {
        field: "invoiceStatus",
        headerName: "Status",
        flex: 0.6,
        renderCell: (params) => (
          <Select value={params.row.invoiceStatus} onChange={(e) => handleStatusChange(params.row.id, e.target.value)}>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Done">Done</MenuItem>
          </Select>
        ),
      },
      {
        field: "Actions",
        headerName: "Actions",
        flex: 0.6,
        renderCell: (params) => (
          <Box>
            <Tooltip title="Edit">
              <Link to={`/invoices/editInvoice/${params.row.id}`}>
                <IconButton onClick={() => handleEditClick(params.row.id)}>
                  <EditIcon />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="View">
              <Link to={`/invoices/viewInvoice/${params.row.id}`}>
                <IconButton>
                  <VisibilityIcon />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton onClick={() => handleDeleteClick(params.row.id)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ];
  
    return (
      <Box sx={pageContainerSx}>
        <Box sx={pageHeaderRowSx}>
          <Header title="Invoices Management" subtitle="Managing the invoices" />
          <Box>
            <Link to={"/invoices/newInvoice"} style={{ textDecoration: "none" }}>
              <Button
                variant="contained"
                sx={actionButtonSx}
              >
                Add an Invoice
              </Button>
            </Link>
          </Box>
        </Box>
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
  <Button
    variant="contained"
    onClick={handleViewInvoices}
    disabled={(!startDate && endDate) || (startDate && !endDate)}
  >
    Filter invoices
  </Button>
  <Button
    variant="outlined"
    onClick={exportToPdf}
  >
    Export as PDF
  </Button>
</Box>
        <Box sx={tableSurfaceSx}>
          <DataGrid
            rows={data}
            columns={columns}
            loading={isPending}
            components={{ Toolbar: GridToolbar }}
          />
        </Box>
      </Box>
    );
  };
  
  export default Invoices;
