import { getAccessToken } from "../../auth/apiClient";
import {
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
  } from "@mui/icons-material";
  import EditIcon from "@mui/icons-material/Edit";
  import { Box, Button, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from "@mui/material";
  import { DataGrid, GridToolbar } from "@mui/x-data-grid";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  import React, { useEffect, useState } from "react";
  import { Link } from "react-router-dom";
  import Swal from "sweetalert2";
  import axios from "axios";
  import Header from "../../components/Header";
  import { environment } from "../../environment";
  import { actionButtonSx, filterBarSx, pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../styles/uiStyles";
  
  const Invoices = () => {
    const [data, setData] = useState([]);
    const token = getAccessToken();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
  
    const fetchInvoices = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        let url = `${environment.apiUrl}/invoice/getAllInvoices`
        if (startDate && endDate) {
          url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const response = await axios.get(url, { headers });
        const responseData = response.data;
        if (responseData.success) {
          const modifiedData = responseData.invoices.map((item) => ({
            ...item,
            id: item._id,
            clientName: `${item.client.firstName} ${item.client.lastName}`,
          }));
          modifiedData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setData(modifiedData);
        } else {
          console.error("Failed to fetch invoices:", responseData.message);
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      }
    };
  
    useEffect(() => {
      fetchInvoices();
    }, []);
  
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
          const headers = { Authorization: `Bearer ${token}` };
          axios
            .delete(`${environment.apiUrl}/invoice/deleteInvoiceById/${id}`, { headers })
            .then((response) => {
              if (response.status !== 200) throw new Error("Failed to delete invoice");
              setData(data.filter((item) => item.id !== id));
              Swal.fire("Deleted!", "The invoice has been deleted.", "success");
            })
            .catch((error) => {
              console.error("Error deleting invoice:", error);
              Swal.fire("Error!", "Failed to delete invoice. Please try again later.", "error");
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
  
              const headers = {
                Authorization: `Bearer ${token}`
              };
          
            axios
              .patch(environment.apiUrl + `/invoice/updateStatus/${id}`, { invoiceStatus: newStatus },{headers})
              .then((response) => {
                  console.log(response);
                if (response.status !== 200) {
                  throw new Error("Failed to update status");
                }
    
                const updatedData = data.map((item) => {
                  if (item.id === id) {
                    return { ...item, invoiceStatus: newStatus };
                  }
                  return item;
                });
                setData(updatedData);
                Swal.fire("Updated!", "The client status has been updated.", "success");
              })
              .catch((error) => {
                console.error("Error updating client status:", error);
                Swal.fire(
                  "Error!",
                  "Failed to update client status. Please try again later.",
                  "error"
                );
              });
          }
        });
      };
      const handleViewInvoices = () => {
        console.log("view jobs")
        fetchInvoices();
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
            components={{ Toolbar: GridToolbar }}
          />
        </Box>
      </Box>
    );
  };
  
  export default Invoices;
