import { getAccessToken } from "../../auth/apiClient";
import {
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
  } from "@mui/icons-material";
  import EditIcon from "@mui/icons-material/Edit";
  import { Box, Button, IconButton, MenuItem, Select, Tooltip } from "@mui/material";
  import { DataGrid, GridToolbar } from "@mui/x-data-grid";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  import React, { useEffect, useState } from "react";
  import { Link } from "react-router-dom";
  import Swal from "sweetalert2";
  import axios from "axios";
  import Header from "../../components/Header";
  import { environment } from "../../environment";
  import { actionButtonSx, pageContainerSx, pageHeaderRowSx, tableSurfaceSx } from "../../styles/uiStyles";


  
  const Clients = () => {
    const [data, setData] = useState([]);
    const [startDate, setStartDate] = useState(null);
const [endDate, setEndDate] = useState(null);


    const token = getAccessToken()
    const fetchClients = async () => {
      try {

        const headers = {
          Authorization: `Bearer ${token}`
        };
  
        const response = await axios.get(`${environment.apiUrl}/client/getAllClient`, { headers });
        const responseData = response.data;
        if (responseData.success) {
          const modifiedData = responseData.clients.map((item) => ({
            ...item,
            id: item._id, // Set id for DataGrid row key
          }));
  
          modifiedData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
          setData(modifiedData);
        } else {
          console.error("Failed to fetch clients:", responseData.message);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      }
    };
  
    useEffect(() => {
      fetchClients();
    }, []);
  
    const exportToPdf = () => {
      const doc = new jsPDF();
      doc.autoTable({
        head: [["Full Name", "Email", "Phone Number", "Client Status"]],
        body: data.map(({ firstName, lastName, email, phoneNumber, clientStatus }) => [
          `${firstName} ${lastName}`,
          email,
          phoneNumber,
          clientStatus,
        ]),
      });
      doc.save("clients_data.pdf");
    };
  
    const handleDeleteClick = (id) => {
      Swal.fire({
        title: "Are you sure?",
        text: "Once deleted, you will not be able to recover this client!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Delete",
      }).then((result) => {
        if (result.isConfirmed) {

            const headers = {
              Authorization: `Bearer ${token}`
            };
          axios
            .delete(environment.apiUrl + `/client/deleteClientById/${id}`,{headers})
            .then((response) => {
              if (response.status !== 200) {
                throw new Error("Failed to delete client");
              }
  
              setData(data.filter((item) => item.id !== id));
              Swal.fire("Deleted!", "The client has been deleted.", "success");
            })
            .catch((error) => {
              console.error("Error deleting client:", error);
              Swal.fire(
                "Error!",
                "Failed to delete client. Please try again later.",
                "error"
              );
            });
        }
      });
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
            .patch(environment.apiUrl + `/client/updateStatus/${id}`, { clientStatus: newStatus },{headers})
            .then((response) => {
                console.log(response);
              if (response.status !== 200) {
                throw new Error("Failed to update status");
              }
  
              const updatedData = data.map((item) => {
                if (item.id === id) {
                  return { ...item, clientStatus: newStatus };
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
  
    const handleEditClick = (id) => {};
    
  
    const columns = [
      {
        field: "fullName",
        headerName: "Full Name",
        flex: 1,
        renderCell: (params) => `${params.row.firstName} ${params.row.lastName}`,
    },
      { field: "email", headerName: "Email", flex: 1 },
      { field: "phoneNumber", headerName: "Phone Number", flex: 1 },
      {
        field: "clientStatus",
        headerName: "Client Status",
        flex: 0.6,
        renderCell: (params) => (
          <Select
            value={params.row.clientStatus}
            onChange={(e) => handleStatusChange(params.row.id, e.target.value)}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
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
              <Link to={`/clients/editClient/${params.row.id}`}>
                <IconButton>
                  <EditIcon onClick={() => handleEditClick(params.row.id)} />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="View">
              <Link to={`/clients/viewClient/${params.row.id}`}>
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
          <Header title="Clients Management" subtitle="Managing the clients" />
          <Box>
            <Link to={"/clients/newClient"} style={{ textDecoration: "none" }}>
              <Button
                variant="contained"
                sx={actionButtonSx}
              >
                Add a Client
              </Button>
            </Link>
          </Box>
        </Box>
        <Box sx={tableSurfaceSx}>
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
          <DataGrid
            rows={data}
            columns={columns}
            components={{ Toolbar: GridToolbar }}
          />
        </Box>
      </Box>
    );
  };
  
  export default Clients;
