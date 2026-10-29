import { getAccessToken } from "../../auth/apiClient";
import {
    Box,
    Button,
    MenuItem,
    Alert as MuiAlert,
    Select,
    Snackbar,
    TextField,
    Typography,
  } from "@mui/material";
  import AlertTitle from "@mui/material/AlertTitle";
  import useMediaQuery from "@mui/material/useMediaQuery";
  import { Formik } from "formik";
  import React, { useState, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import * as yup from "yup";
  import axios from "axios";
  import Header from "../../components/Header";
  import { environment } from "../../environment";
  import { pageContainerSx, surfaceSx } from "../../styles/uiStyles";
  import InvoicePreview from "./InvoicePreview";
  
  const AddInvoice = () => {
    const isNonMobile = useMediaQuery("(min-width:600px)");
    const [loading, setLoading] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertSeverity, setAlertSeverity] = useState("success");
    const [clients, setClients] = useState([]);
    const navigate = useNavigate();
  
    useEffect(() => {
      fetchClients();
    }, []);
    const token = getAccessToken();
  
    const fetchClients = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(environment.apiUrl + "/client/getAllActiveClient", { headers });
        if (response.data.success) {
          setClients(response.data.clients);
        } else {
          setAlertSeverity("error");
          setAlertMessage("Failed to fetch clients");
          setOpenSnackbar(true);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        setAlertSeverity("error");
        setAlertMessage("Failed to fetch clients");
        setOpenSnackbar(true);
      }
    };
  
    const handleFormSubmit = async (values, { resetForm }) => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.post(environment.apiUrl + "/invoice/addInvoice", values, { headers });
        if (response.data.success) {
          setAlertSeverity("success");
          setAlertMessage("Invoice Added Successfully");
          setTimeout(() => {
            navigate("/invoices");
          }, 2000);
          resetForm();
        } else {
          setAlertSeverity("error");
          setAlertMessage(response.data.message || "Failed to add invoice");
        }
      } catch (error) {
        console.error("Error creating invoice:", error);
        setAlertSeverity("error");
        setAlertMessage("Failed to add invoice");
      } finally {
        setLoading(false);
        setOpenSnackbar(true);
      }
    };
  
    return (
      <Box sx={pageContainerSx}>
        <Header title="Add Invoice" subtitle="" />
        <Snackbar
          open={openSnackbar}
          autoHideDuration={5000}
          onClose={() => setOpenSnackbar(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MuiAlert
            onClose={() => setOpenSnackbar(false)}
            severity={alertSeverity}
            elevation={6}
            variant="filled"
            sx={{ color: "#fff" }}
          >
            <AlertTitle>{alertSeverity === "success" ? "Success" : "Error"}</AlertTitle>
            {alertMessage}
          </MuiAlert>
        </Snackbar>
        <Formik
          onSubmit={handleFormSubmit}
          initialValues={initialValues}
          validationSchema={invoiceSchema}
        >
          {({
            values,
            errors,
            touched,
            handleBlur,
            handleChange,
            handleSubmit,
          }) => (
            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              <Box
                display="grid"
                gridTemplateColumns={isNonMobile ? "minmax(0, 1.1fr) minmax(340px, 0.9fr)" : "1fr"}
                alignItems="start"
                gap={2.5}
              >
                <Box sx={{ ...surfaceSx, p: { xs: 2, sm: 3 } }}>
                  <Box
                    display="grid"
                    gap={1.5}
                    alignItems="center"
                    gridTemplateColumns={isNonMobile ? "minmax(125px, 0.35fr) minmax(0, 1fr)" : "1fr"}
                  >
                    <Typography fontWeight="bold" fontSize="14px">Invoice Title*</Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      type="text"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.invoiceTitle}
                      name="invoiceTitle"
                      error={!!touched.invoiceTitle && !!errors.invoiceTitle}
                      helperText={touched.invoiceTitle && errors.invoiceTitle}
                    />
                    <Typography fontWeight="bold" fontSize="14px">Description*</Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      type="text"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.invoiceDescription}
                      name="invoiceDescription"
                      multiline
                      rows={4}
                      error={!!touched.invoiceDescription && !!errors.invoiceDescription}
                      helperText={touched.invoiceDescription && errors.invoiceDescription}
                    />
                    <Typography fontWeight="bold" fontSize="14px">Client*</Typography>
                    <Box>
                      <Select
                        fullWidth
                        variant="filled"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        value={values.client}
                        name="client"
                        error={!!touched.client && !!errors.client}
                      >
                        {clients.map((client) => (
                          <MenuItem key={client._id} value={client._id}>
                            {client.firstName} {client.lastName}
                          </MenuItem>
                        ))}
                      </Select>
                      {touched.client && errors.client && (
                        <Typography color="error" variant="caption">{errors.client}</Typography>
                      )}
                    </Box>
                    <Typography fontWeight="bold" fontSize="14px">Amount (LKR)*</Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      type="number"
                      inputProps={{ min: 0, step: "0.01" }}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.amount}
                      name="amount"
                      error={!!touched.amount && !!errors.amount}
                      helperText={touched.amount && errors.amount}
                    />
                    <Typography fontWeight="bold" fontSize="14px">Send Date*</Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      type="date"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.sendDate}
                      name="sendDate"
                      error={!!touched.sendDate && !!errors.sendDate}
                      helperText={touched.sendDate && errors.sendDate}
                    />
                    <Typography fontWeight="bold" fontSize="14px">Notes</Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      type="text"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.notes}
                      name="notes"
                      multiline
                      rows={3}
                      error={!!touched.notes && !!errors.notes}
                      helperText={touched.notes && errors.notes}
                    />
                  </Box>
                  <Box display="flex" justifyContent="end" mt={2.5}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      sx={{
                        backgroundColor: "#6870fa",
                        color: "white",
                        fontSize: "16px",
                        "&:hover": { backgroundColor: "#3e4396" },
                      }}
                    >
                      {loading ? "Adding..." : "Create invoice"}
                    </Button>
                  </Box>
                </Box>
                <InvoicePreview
                  invoice={values}
                  client={clients.find((client) => client._id === values.client)}
                  preview
                />
              </Box>
            </form>
          )}
        </Formik>
      </Box>
    );
  };
  
  const invoiceSchema = yup.object().shape({
    invoiceTitle: yup.string().required("Invoice Title is required"),
    invoiceDescription: yup.string().required("Description is required"),
    client: yup.string().required("Client is required"),
    amount: yup.number().required("Amount is required").nullable(),
    sendDate: yup.date().required("Send Date is required").nullable(),
    notes: yup.string().max(2000, "Notes must be 2000 characters or fewer"),
  });
  
  const initialValues = {
    invoiceTitle: "",
    invoiceDescription: "",
    client: "",
    amount: "",
    sendDate: "",
    notes: "",
  };
  
  export default AddInvoice;
