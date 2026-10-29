import { getAccessToken } from "../../auth/apiClient";
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import axios from 'axios';
import { useNavigate, useParams } from "react-router-dom";
import { Formik, Field, Form } from 'formik';
import * as yup from 'yup';
import Header from "../../components/Header";
import { environment } from "../../environment";
import { formPageSx } from "../../styles/uiStyles";

// Validation schema
const invoiceSchema = yup.object().shape({
  invoiceTitle: yup.string().required("Invoice Title is required"),
  invoiceDescription: yup.string().required("Description is required"),
  client: yup.string().required("Client is required"),
  amount: yup.number().required("Amount is required").nullable(),
  sendDate: yup.date().required("Send Date is required").nullable(),
  notes: yup.string().max(2000, "Notes must be 2000 characters or fewer"),
});

const EditInvoice = () => {
  const { id } = useParams();
  const token = getAccessToken();

  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceTitle: "",
    invoiceDescription: "",
    sendDate: "",
    client: "",
    amount: "",
    notes: "",
  });

  const [clients, setClients] = useState([]);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    fetchClients();
    fetchInvoiceDetails();
  }, [id]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(environment.apiUrl + "/client/getAllActiveClient", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

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

  const fetchInvoiceDetails = async () => {
    try {
      const response = await axios.get(environment.apiUrl + `/invoice/getInvoiceById/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const responseData = response.data;
      if (responseData.success) {
        const invoice = responseData.invoice;
        // Format the sendDate to YYYY-MM-DD for the input field
        if (invoice.sendDate) {
          invoice.sendDate = new Date(invoice.sendDate).toISOString().split('T')[0];
        }
        // Ensure client is set as client ID
        setInvoiceDetails({ ...invoice, client: invoice.client._id, notes: invoice.notes || "" });
      } else {
        console.error('Failed to fetch invoice details:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
    }
  };

  const handleUpdateInvoice = async (values) => {
    setIsLoading(true);

    try {
      const response = await axios.put(environment.apiUrl + `/invoice/updatedInvoice/${id}`, values, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 200) {
        setInvoiceDetails(values);
        setAlertSeverity('success');
        setAlertMessage('Invoice updated successfully');
        setTimeout(() => {
          navigate('/invoices');
        }, 2000);
      } else {
        setAlertSeverity('error');
        setAlertMessage(`Failed to update invoice: ${response.data.message}`);
      }
    } catch (error) {
      setAlertSeverity('error');
      setAlertMessage(`Error updating invoice: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title={`Edit Invoice ID: ${id}`} subtitle="" />
      <Box>
        <Formik
          initialValues={invoiceDetails}
          validationSchema={invoiceSchema}
          enableReinitialize={true}
          onSubmit={handleUpdateInvoice}
        >
          {({ values, handleChange, handleBlur, errors, touched }) => (
            <Form>
              <Grid container spacing={2}>
                {/* Render fields */}
                {Object.entries(invoiceDetails).map(([field, value]) => {
                  if (field === 'client' || field === 'createdAt' || field === 'updatedAt' || field === '_id' || field === '__v' || field === 'invoiceStatus') {
                    return null;
                  }

                  return (
                    <Grid item xs={12} key={field}>
                      <Typography variant="h5" component="span" fontWeight="bold">
                        {`${field.charAt(0).toUpperCase() + field.slice(1)}:`}
                      </Typography>
                      {/* Render appropriate input based on field */}
                      {field === 'sendDate' ? (
                        <TextField
                          fullWidth
                          variant="filled"
                          type="date"
                          name="sendDate"
                          value={values.sendDate || ''}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.sendDate && !!errors.sendDate}
                          helperText={touched.sendDate && errors.sendDate}
                        />
                      ) : (
                        <TextField
                          fullWidth
                          variant="filled"
                          margin="normal"
                          name={field}
                          value={values[field]}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched[field] && !!errors[field]}
                          helperText={touched[field] && errors[field]}
                          multiline={field === 'invoiceDescription'}
                          rows={field === 'invoiceDescription' ? 3 : 1}
                        />
                      )}
                    </Grid>
                  );
                })}
                {/* Client field */}
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Client:
                  </Typography>
                  <Select
                    fullWidth
                    variant="filled"
                    value={values.client || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    name="client"
                    error={touched.client && !!errors.client}
                  >
                    {clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched.client && errors.client && (
                    <Typography color="error">{errors.client}</Typography>
                  )}
                </Grid>
                {/* Update button */}
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isLoading}
                    sx={{
                      backgroundColor: '#6870fa',
                      color: 'white',
                      marginRight: 2,
                      fontSize: '16px',
                      '&:hover': {
                        backgroundColor: '#3e4396',
                      },
                    }}
                  >
                    {isLoading ? 'Updating...' : 'Update Invoice'}
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Box>
      {/* Snackbar for alerts */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MuiAlert
          onClose={() => setOpenSnackbar(false)}
          severity={alertSeverity}
          elevation={6}
          variant="filled"
          sx={{ color: '#fff' }}
        >
          {alertSeverity === 'success' ? 'Success' : 'Error'}
          {': '}
          {alertMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default EditInvoice;
