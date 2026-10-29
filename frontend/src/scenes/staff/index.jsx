import { getAccessToken } from "../../auth/apiClient";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PaymentsIcon from "@mui/icons-material/Payments";
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
  
  const Staff = () => {
    const [data, setData] = useState([]);
  
    const token = getAccessToken();
  
    const fetchStaff = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };
  
        const response = await axios.get(`${environment.apiUrl}/staff/getAllStaff`, { headers });
        const responseData = response.data;
        if (responseData.success) {
          const modifiedData = responseData.staffs.map((item) => ({
            ...item,
            id: item._id, // Set id for DataGrid row key
          }));
  
          modifiedData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
          setData(modifiedData);
        } else {
          console.error("Failed to fetch staff:", responseData.message);
        }
      } catch (error) {
        console.error("Error fetching staff:", error);
      }
    };
  
    useEffect(() => {
      fetchStaff();
    }, []);
  
    const exportToPdf = () => {
      const doc = new jsPDF();
      doc.autoTable({
        head: [["Full Name", "Supervisor", "Position", "Phone Number", "Work Status"]],
        body: data.map(({ firstName, lastName, supervisorName, position, phoneNumber, workStatus }) => [
          `${firstName} ${lastName}`,
          supervisorName,
          position,
          phoneNumber,
          workStatus,
        ]),
      });
      doc.save("staff_data.pdf");
    };
  
    const handleDeleteClick = (id) => {
      Swal.fire({
        title: "Are you sure?",
        text: "Once deleted, you will not be able to recover this staff!",
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
            .delete(environment.apiUrl + `/staff/deleteStaffById/${id}`, { headers })
            .then((response) => {
              if (response.status !== 200) {
                throw new Error("Failed to delete staff");
              }
  
              setData(data.filter((item) => item.id !== id));
              Swal.fire("Deleted!", "The staff has been deleted.", "success");
            })
            .catch((error) => {
              console.error("Error deleting staff:", error);
              Swal.fire(
                "Error!",
                "Failed to delete staff. Please try again later.",
                "error"
              );
            });
        }
      });
    };
  
    const handleStatusChange = (id, newStatus) => {
      Swal.fire({
        title: "Are you sure?",
        text: "Do you want to change the status of this staff?",
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
            .patch(environment.apiUrl + `/staff/updateStatus/${id}`, { workStatus: newStatus }, { headers })
            .then((response) => {
              if (response.status !== 200) {
                throw new Error("Failed to update status");
              }
  
              const updatedData = data.map((item) => {
                if (item.id === id) {
                  return { ...item, workStatus: newStatus };
                }
                return item;
              });
              setData(updatedData);
              Swal.fire("Updated!", "The staff status has been updated.", "success");
            })
            .catch((error) => {
              console.error("Error updating staff status:", error);
              Swal.fire(
                "Error!",
                "Failed to update staff status. Please try again later.",
                "error"
              );
            });
        }
      });
    };
  
    const handleEditClick = (id) => {};

    const getTimesheetsUrl = (staff) => {
      const params = new URLSearchParams({ staffId: staff.id });
      return `/timesheets?${params.toString()}`;
    };
  
    const columns = [
      {
        field: "fullName",
        headerName: "Full Name",
        flex: 1,
        renderCell: (params) => `${params.row.firstName} ${params.row.lastName}`,
      },
      { field: "supervisorName", headerName: "Supervisor", flex: 1 },
      { field: "position", headerName: "Position", flex: 1 },
      { field: "payFrequency", headerName: "Pay Frequency", flex: 0.8, valueGetter: (params) => params.row.payFrequency || "Weekly" },
      { field: "phoneNumber", headerName: "Phone Number", flex: 1 },
      {
        field: "workStatus",
        headerName: "Work Status",
        flex: 0.6,
        renderCell: (params) => (
          <Select
            value={params.row.workStatus}
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
        flex: 0.9,
        minWidth: 220,
        renderCell: (params) => (
          <Box>
            <Tooltip title="Edit">
              <Link to={`/staff/editStaff/${params.row.id}`}>
                <IconButton>
                  <EditIcon onClick={() => handleEditClick(params.row.id)} />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="View">
              <Link to={`/staff/viewStaff/${params.row.id}`}>
                <IconButton>
                  <VisibilityIcon />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="Timesheets">
              <Link to={getTimesheetsUrl(params.row)}>
                <IconButton aria-label={`View timesheets for ${params.row.firstName} ${params.row.lastName}`}>
                  <AccessTimeIcon />
                </IconButton>
              </Link>
            </Tooltip>
            <Tooltip title="Payroll and payout receipts">
              <Link to={`/staff/viewstaff/${params.row.id}/jobs`}>
                <IconButton aria-label={`View payroll for ${params.row.firstName} ${params.row.lastName}`}>
                  <PaymentsIcon />
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
          <Header title="Staff Management" subtitle="Managing the staff" />
          <Box>
            <Link to={"/staff/newStaff"} style={{ textDecoration: "none" }}>
              <Button
                variant="contained"
                sx={actionButtonSx}
              >
                Add a Staff
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
  
  export default Staff;
