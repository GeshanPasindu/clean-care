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
import { useNavigate, useParams } from "react-router-dom";
import { Formik, Field, Form } from 'formik';
import * as yup from 'yup';
import Header from "../../components/Header";
import { formPageSx } from "../../styles/uiStyles";
import { useActiveClients } from "../clients/clientQueries";
import { useServiceMutation } from "../../queries/queryHelpers";
import { invoiceService } from "../../services/invoiceService";
import { useInvoice, invoiceQueryKeys } from "./invoiceQueries";

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
  const invoiceQuery = useInvoice(id);
  const clientsQuery = useActiveClients();
  const clients = clientsQuery.data?.clients || [];
  const updateInvoice = useServiceMutation(
    ({ invoiceId, values }) => invoiceService.update(invoiceId, values),
    { invalidate: [invoiceQueryKeys.all, invoiceQueryKeys.detail(id)] }
  );
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceTitle: "",
    invoiceDescription: "",
    sendDate: "",
    client: "",
    amount: "",
    notes: "",
  });

  const navigate = useNavigate();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    const invoice = invoiceQuery.data?.invoice;
    if (!invoice) return;
    const sendDate = invoice.sendDate
      ? new Date(invoice.sendDate).toISOString().split('T')[0]
      : "";
    const clientId = typeof invoice.client === "object" ? invoice.client?._id : invoice.client;
    setInvoiceDetails({ ...invoice, sendDate, client: clientId || "", notes: invoice.notes || "" });
  }, [invoiceQuery.data]);

  const handleUpdateInvoice = async (values) => {
    try {
      await updateInvoice.mutateAsync({ invoiceId: id, values });
      setInvoiceDetails(values);
      setAlertSeverity('success');
      setAlertMessage('Invoice updated successfully');
      setTimeout(() => {
        navigate('/invoices');
      }, 2000);
    } catch (error) {
      setAlertSeverity('error');
      setAlertMessage(`Error updating invoice: ${error.message}`);
    } finally {
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
                    disabled={updateInvoice.isPending}
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
                    {updateInvoice.isPending ? 'Updating...' : 'Update Invoice'}
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
