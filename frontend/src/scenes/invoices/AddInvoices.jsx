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
  import { formPageSx } from "../../styles/uiStyles";
  
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
          setAlertMessage(response.data.result.message);
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
      <Box sx={formPageSx}>
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
            setFieldValue,
          }) => (
            <form onSubmit={handleSubmit}>
              <Box display="grid" gap="30px" gridTemplateColumns={isNonMobile ? "repeat(1, 1fr)" : "repeat(1, 1fr)"}>
                <Typography fontWeight="bold" fontSize="16px">Invoice Title*</Typography>
                <Box mt={-2}>
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
                </Box>
                <Typography fontWeight="bold" fontSize="16px">Description*</Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="text"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.invoiceDescription}
                    name="invoiceDescription"
                    multiline
                    rows={5}
                    error={!!touched.invoiceDescription && !!errors.invoiceDescription}
                    helperText={touched.invoiceDescription && errors.invoiceDescription}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">Client*</Typography>
                <Box mt={-2}>
                  <Select
                    fullWidth
                    variant="filled"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.client}
                    name="client"
                    error={!!touched.client && !!errors.client}
                    helperText={touched.client && errors.client}
                  >
                    {clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Typography fontWeight="bold" fontSize="16px">Amount*</Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="number"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.amount}
                    name="amount"
                    error={!!touched.amount && !!errors.amount}
                    helperText={touched.amount && errors.amount}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">Send Date*</Typography>
                <Box mt={-2}>
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
                </Box>
                <Typography fontWeight="bold" fontSize="16px">Notes</Typography>
                <Box mt={-2}>
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
              </Box>
              {/* Submit Button */}
              <Box display="flex" justifyContent="end" mt="20px">
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    backgroundColor: "#6870fa",
                    color: "white",
                    marginRight: 2,
                    fontSize: "16px",
                    "&:hover": {
                      backgroundColor: "#3e4396",
                    },
                  }}
                >
                  {loading ? "Adding..." : "Add"}
                </Button>
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
    notes: yup.string(),
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
