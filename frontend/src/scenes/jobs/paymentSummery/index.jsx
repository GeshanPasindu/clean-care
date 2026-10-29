import { getAccessToken } from "../../../auth/apiClient";
import {
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
  } from "@mui/icons-material";
  import EditIcon from "@mui/icons-material/Edit";
  import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
  import {
    Box,
    Button,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    Typography,
    TextField,
  } from "@mui/material";
  import { DataGrid, GridToolbar } from "@mui/x-data-grid";
  import jsPDF from "jspdf";
  import "jspdf-autotable";
  import React, { useEffect, useRef, useState } from "react";
  import { Link } from "react-router-dom";
  import Swal from "sweetalert2";
  import axios from "axios";
  import Header from "../../../components/Header";
import { useAuth } from "../../../auth/AuthContext";
  import { environment } from "../../../environment.js";
  import { filterBarSx, pageContainerSx, pageHeaderRowSx, surfaceSx, tableSurfaceSx } from "../../../styles/uiStyles";
  import PaymentReceiptDialog from "./PaymentReceiptDialog";


  const Jobs = () => {
    const { user } = useAuth();
    const [data, setData] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [staff, setStaff] = useState([]);
    const [clients, setClients] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState("");
    const [selectedClient, setSelectedClient] = useState("");
    const token = getAccessToken();
    const fetchAllRef = useRef(false);

    const [totalPayment, setTotalPayment] = useState(0);
    const [staffPayment, setStaffPayment] = useState(0);
    const [receivedPayment, setReceivedPayment] = useState(0);
    const [profit, setProfit] = useState(0);
    const [selectedJob, setSelectedJob] = useState(null);
    
    
  
    const userRole = user?.role;
    const shouldShowButton = userRole !== "staff";
    const userStaff = userRole ==='staff'
  
    const userId = user?.id;
    const formatTime = (dateTime) => {
      if (!dateTime) return null;
      const time = new Date(dateTime);
      return time.toLocaleTimeString("en-CA", { day:'2-digit',month:'2-digit',year:'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',hour12: false, });
    };
  
    // const fetchJobs = async () => {
    //   try {
    //     let response;
    //     if (userRole === "staff") {
    //       response = await axios.get(environment.apiUrl + `/job/getJobsbyStaff/${userId}`);
    //     } else {
    //       response = await axios.get(environment.apiUrl + "/job/getAllJobs");
    //     }
  
    //     const responseData = response.data;
    //     if (responseData.success) {
          
    //       const modifiedData = responseData.jobs.map((item) => ({
    //         ...item,
    //         startTime: item.startTime.split("T")[0],
    //         signInTime:formatTime(item.signInTime),
    //         signOffTime:formatTime(item.signOffTime),
    //         id: item._id, // Set id for DataGrid row key
    //       }));
  
    //       modifiedData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
    //       setData(modifiedData);
    //     } else {
    //       console.error("Failed to fetch jobs:", responseData.message);
    //     }
    //   } catch (error) {
    //     console.error("Error fetching jobs:", error);
    //   }
    // };

    const fetchJobs = async () => {
        try {
          if (fetchAllRef.current) { }
          let url;
          if (userRole === "staff") {
            url = environment.apiUrl + `/job/getJobsbyStaff/${userId}`;
          } else {
            url = environment.apiUrl + "/job/getAllJobs";
          }
    
          let params = new URLSearchParams();
          if (startDate) params.append("startDate", startDate);
          if (endDate) params.append("endDate", endDate);
          if (selectedStaff) params.append("staffId", selectedStaff);
          if (selectedClient) params.append("clientId", selectedClient);
    
          if (fetchAllRef.current) {
            params.delete('startDate');
            params.delete("endDate");
            params.delete("staffId");
            params.delete("clientId");
          }
    
          const response = await axios.get(url, { params });
          const responseData = response.data;
          console.log(responseData)
          if (responseData.success) {
            fetchAllRef.current = false;
            const modifiedData = responseData.jobs.map((item) => ({
              ...item,
              id: item._id,
              jobDate: formatTime(item.jobDate)
            }));
    
            modifiedData.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setData(modifiedData);
            calculateSummary(modifiedData);
          } else {
            fetchAllRef.current = false;
            console.error("Failed to fetch jobs:", responseData.message);
          }
        } catch (error) {
          fetchAllRef.current = false;
          console.error("Error fetching jobs:", error);
          if (error.response.data.message === 'Jobs not found') {
            setData([])
            calculateSummary([]);
          }
        }
      };

    const calculateSummary = (jobs) => {
        const totalPayment = jobs.reduce((acc, job) => acc + (job.orgTotal || 0), 0);
        const receivedPayment = jobs.reduce((acc, job) => acc + (job.receivedPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0);
        const staffPayment = jobs.reduce((acc, job) => acc + (job.staffPayTotal || 0), 0);
        const profit = totalPayment - staffPayment;
        setTotalPayment(totalPayment);
        setReceivedPayment(receivedPayment);
        setStaffPayment(staffPayment);
        setProfit(profit);
      };

    const handlePaymentSaved = (updatedJob) => {
      setSelectedJob(updatedJob);
      const updatedRows = data.map((row) => row.id === String(updatedJob._id)
        ? { ...row, receivedPayments: updatedJob.receivedPayments }
        : row);
      setData(updatedRows);
      calculateSummary(updatedRows);
    };
    const fetchStaffAndClients = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };
    
        const [staffResponse, clientResponse] = await Promise.all([
          axios.get(`${environment.apiUrl}/staff/getAllStaff`, { headers }),
          axios.get(`${environment.apiUrl}/client/getAllClient`, { headers })
        ]);
    
        const staffData = staffResponse.data.staffs.map((item) => ({
          ...item,
          id: item._id
        }));
        const clientData = clientResponse.data.clients.map((item) => ({
          ...item,
          id: item._id
        }));
    
        setStaff(staffData);
        setClients(clientData);
      } catch (error) {
        console.error("Error fetching staff or clients:", error);
      }
    };
    
  
  
    useEffect(() => {
      fetchJobs();
      if(shouldShowButton){
        fetchStaffAndClients();

      }
      
    }, []);
  
    const exportToPdf = () => {
      const doc = new jsPDF();
      doc.autoTable({
        head: [["Job ID", "Job Name", "Client", "Assigned Staff", "Start Time"]],
        body: data.map(({ _id, jobName, client, assignedStaff, startTime }) => [
          _id,
          jobName,
          `${client.firstName} ${client.lastName} `,
          (Array.isArray(assignedStaff) ? assignedStaff : [assignedStaff])
            .map((staff) => `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", "),
          startTime,
        ]),
      });
      doc.save("jobs_data.pdf");
    };
  
    const handleStatusChange = async (id, newStatus) => {
      try {
        const response = await axios.patch(
          environment.apiUrl + `/job/updateStatus/${id}`,
          { jobStatus: newStatus }
        );
        if (response.data.success) {
          setData((prevData) =>
            prevData.map((item) =>
              item.id === id ? { ...item, jobStatus: newStatus } : item
            )
          );
          Swal.fire("Updated!", "Job status has been updated.", "success");
        } else {
          throw new Error(response.data.message);
        }
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
          axios
            .delete(environment.apiUrl + `/job/deleteJobById/${id}`)
            .then((response) => {
              if (response.status !== 200) {
                throw new Error("Failed to delete job");
              }
  
              setData(data.filter((item) => item.id !== id));
              Swal.fire("Deleted!", "The job has been deleted.", "success");
              calculateSummary(data.filter((item) => item.id !== id));

            })
            .catch((error) => {
              console.error("Error deleting job:", error);
              Swal.fire("Error!", "Failed to delete job. Please try again later.", "error");
            });
        }
      });
    };
  
    const handleEditClick = (id) => { };

    const handleViewJobs = () => {
      fetchJobs();
    };

    const vievAlljobs = () =>{
      fetchAllRef.current = true;
      setEndDate('');
      setStartDate('');
      setSelectedClient('')
      setSelectedStaff('');
      fetchJobs();
    }
    
    
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
        <Box sx={tableSurfaceSx}>
          <DataGrid
            rows={data}
            columns={columns}
            components={{ Toolbar: GridToolbar }}
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
