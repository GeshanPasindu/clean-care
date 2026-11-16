import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import type { GridColumns } from "@mui/x-data-grid";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import Header from "../../components/Header";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  actionButtonSx,
  pageContainerSx,
  pageHeaderRowSx,
  tableSurfaceSx,
} from "../../styles/uiStyles";
import type { AccountStatus } from "../../types/domain";
import { accountStatusSchema } from "../../types/domain";
import {
  useClientPage,
  useDeleteClient,
  useUpdateClientStatus,
} from "./clientQueries";

const Clients = () => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const params = {
    page: page + 1,
    limit: pageSize,
    ...(search ? { search } : {}),
  };
  const { data: responseData, isPending } = useClientPage(params);
  const deleteClient = useDeleteClient();
  const updateClientStatus = useUpdateClientStatus();
  const data = (responseData?.clients || []).map((item) => ({
    ...item,
    id: item._id,
  }));

  const exportToPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["Full Name", "Email", "Phone Number", "Client Status"]],
      body: data.map(
        ({ firstName, lastName, email, phoneNumber, clientStatus }) => [
          `${firstName} ${lastName}`,
          email,
          phoneNumber,
          clientStatus || "",
        ],
      ),
    });
    doc.save("clients_data.pdf");
  };

  const handleDeleteClick = (id: string) => {
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
        deleteClient.mutate(id, {
          onSuccess: () =>
            Swal.fire("Deleted!", "The client has been deleted.", "success"),
          onError: (error) => {
            console.error("Error deleting client:", error);
            Swal.fire(
              "Error!",
              "Failed to delete client. Please try again later.",
              "error",
            );
          },
        });
      }
    });
  };

  const handleStatusChange = (id: string, newStatus: AccountStatus) => {
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
        updateClientStatus.mutate(
          { id, status: newStatus },
          {
            onSuccess: () =>
              Swal.fire(
                "Updated!",
                "The client status has been updated.",
                "success",
              ),
            onError: (error) => {
              console.error("Error updating client status:", error);
              Swal.fire(
                "Error!",
                "Failed to update client status. Please try again later.",
                "error",
              );
            },
          },
        );
      }
    });
  };

  const handleEditClick = (id: string) => {};

  const columns: GridColumns<(typeof data)[number]> = [
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
          onChange={(e) =>
            handleStatusChange(
              params.row.id,
              accountStatusSchema.parse(e.target.value),
            )
          }
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
            <Button variant="contained" sx={actionButtonSx}>
              Add a Client
            </Button>
          </Link>
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <TextField
          size="small"
          label="Search clients"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 260 }}
        />
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
          loading={isPending}
          page={page}
          pageSize={pageSize}
          rowCount={responseData?.paginationInfo?.totalResult || 0}
          paginationMode="server"
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(0);
          }}
          components={{ Toolbar: GridToolbar }}
        />
      </Box>
    </Box>
  );
};

export default Clients;
