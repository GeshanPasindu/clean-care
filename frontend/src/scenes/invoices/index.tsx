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
  Typography,
} from "@mui/material";
import type { GridColumns } from "@mui/x-data-grid";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import FormField from "../../components/forms/FormField";
import Header from "../../components/Header";
import { useDateRangeForm } from "../../hooks/useDateRangeForm";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  actionButtonSx,
  filterBarSx,
  pageContainerSx,
  pageHeaderRowSx,
  tableSurfaceSx,
} from "../../styles/uiStyles";
import type { PaymentStatus } from "../../types/domain";
import { paymentStatusSchema } from "../../types/domain";
import {
  useDeleteInvoice,
  useInvoices,
  useUpdateInvoiceStatus,
} from "./invoiceQueries";

const Invoices = () => {
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
  const { data: responseData, isPending } = useInvoices(queryParams);
  const deleteInvoice = useDeleteInvoice();
  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const data = (responseData?.invoices || []).map((item) => ({
    ...item,
    id: item._id,
    clientName: [item.client?.firstName, item.client?.lastName]
      .filter(Boolean)
      .join(" "),
  }));

  const exportToPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Invoice ID",
          "Title",
          "Description",
          "Send Date",
          "Client Name",
          "Amount",
          "Status",
        ],
      ],
      body: data.map(
        ({
          _id,
          invoiceTitle,
          invoiceDescription,
          sendDate,
          clientName,
          amount,
          invoiceStatus,
        }) => [
          _id,
          invoiceTitle,
          invoiceDescription,
          new Date(sendDate || "").toLocaleDateString(),
          clientName,
          amount || 0,
          invoiceStatus,
        ],
      ),
    });
    doc.save("invoices_data.pdf");
  };

  const handleDeleteClick = (id: string) => {
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
          onSuccess: () =>
            Swal.fire("Deleted!", "The invoice has been deleted.", "success"),
          onError: (error) => {
            console.error("Error deleting invoice:", error);
            Swal.fire(
              "Error!",
              "Failed to delete invoice. Please try again later.",
              "error",
            );
          },
        });
      }
    });
  };

  const handleEditClick = (id: string) => {
    // Implement the edit functionality
  };

  const handleStatusChange = (id: string, newStatus: PaymentStatus) => {
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
            onSuccess: () =>
              Swal.fire(
                "Updated!",
                "The invoice status has been updated.",
                "success",
              ),
            onError: (error) => {
              console.error("Error updating invoice status:", error);
              Swal.fire(
                "Error!",
                "Failed to update invoice status. Please try again later.",
                "error",
              );
            },
          },
        );
      }
    });
  };
  const handleViewInvoices = () => {
    setFilters(startDate && endDate ? { startDate, endDate } : {});
    setPage(0);
  };
  const columns: GridColumns<(typeof data)[number]> = [
    { field: "id", headerName: "Invoice ID", flex: 1 },
    { field: "invoiceTitle", headerName: "Title", flex: 0.6 },
    { field: "invoiceDescription", headerName: "Description", flex: 0.8 },
    {
      field: "sendDate",
      headerName: "Send Date",
      flex: 0.6,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    { field: "clientName", headerName: "Client Name", flex: 0.8 },
    { field: "amount", headerName: "Amount", flex: 0.6 },
    {
      field: "invoiceStatus",
      headerName: "Status",
      flex: 0.6,
      renderCell: (params) => (
        <Select
          value={params.row.invoiceStatus}
          onChange={(e) =>
            handleStatusChange(
              params.row.id,
              paymentStatusSchema.parse(e.target.value),
            )
          }
        >
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
            <Button variant="contained" sx={actionButtonSx}>
              Add an Invoice
            </Button>
          </Link>
        </Box>
      </Box>
      <Box sx={filterBarSx}>
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
        <TextField
          size="small"
          label="Search invoices"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 220 }}
        />
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
          onClick={submitRange(handleViewInvoices)}
          disabled={Boolean((!startDate && endDate) || (startDate && !endDate))}
        >
          Filter invoices
        </Button>
        <Button variant="outlined" onClick={exportToPdf}>
          Export as PDF
        </Button>
      </Box>
      <Box sx={tableSurfaceSx}>
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

export default Invoices;
