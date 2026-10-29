import { getAccessToken } from "../../auth/apiClient";
import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, Snackbar, TextField, Typography } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import axios from 'axios';
import { useNavigate, useParams } from "react-router-dom";
import { useFormik } from 'formik';
import * as yup from 'yup';
import Header from "../../components/Header";
import { environment } from '../../environment';
import { formPageSx } from "../../styles/uiStyles";

const EditClient = () => {
  const { id } = useParams();
  const token = getAccessToken();

  const [clientDetails, setClientDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    phoneNumber: "",
    contactName: "",
    contactPhoneNumber: "",
    contactEmail: "",
    accountManager: "",
    notes: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');
  const navigate = useNavigate();
  const clientName = [clientDetails.firstName, clientDetails.lastName].filter(Boolean).join(" ");

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  const fetchClientDetails = async () => {
    try {
      const response = await axios.get(environment.apiUrl + `/client/getClientById/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const responseData = response.data;
      if (responseData.success) {
        setClientDetails(responseData.client);
        formik.setValues(responseData.client);
      } else {
        console.error('Failed to fetch client details:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
    }
  };

  const clientSchema = yup.object().shape({
    firstName: yup.string().required("First Name is required"),
    lastName: yup.string().required("Last Name is required"),
    email: yup.string().email("Invalid email format").required("Email is required"),
    address: yup.string().required("Address is required"),
    phoneNumber: yup.string().required("Phone Number is required"),
    contactName: yup.string(),
    contactPhoneNumber: yup.string(),
    contactEmail: yup.string().email("Invalid email format"),
    accountManager: yup.string(),
    notes: yup.string(),
  });

  const formik = useFormik({
    initialValues: clientDetails,
    validationSchema: clientSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setIsLoading(true);

      try {
        const response = await axios.put(environment.apiUrl + `/client/updateClientById/${id}`, values, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 200) {
          setAlertSeverity('success');
          setAlertMessage('Client updated successfully');
          setTimeout(() => {
            navigate('/clients');
          }, 2000);
        } else {
          setAlertSeverity('error');
          setAlertMessage(`Failed to update client: ${response.data.message}`);
        }
      } catch (error) {
        setAlertSeverity('error');
        setAlertMessage(`Error updating client: ${error.message}`);
      } finally {
        setIsLoading(false);
        setOpenSnackbar(true);
      }
    },
  });

  return (
    <Box sx={formPageSx}>
      <Header title={clientName ? `Edit Client: ${clientName}` : "Edit Client"} subtitle="" />
      <Box>
        <form onSubmit={formik.handleSubmit}>
          <Grid container spacing={2}>
            {Object.entries(clientDetails).map(([field]) => (
              <React.Fragment key={field}>
                {field !== 'createdAt' && field !== 'clientStatus' && field !== '__v' && field !== '_id' && field !== 'updatedAt' && field !== 'adminId' && (
                  <Grid item xs={12}>
                    <Typography variant="h5" component="span" fontWeight="bold">
                      {`${field.charAt(0).toUpperCase() + field.slice(1)}:`}
                    </Typography>
                    <TextField
                      fullWidth
                      variant="filled"
                      margin="normal"
                      name={field}
                      value={formik.values[field]}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched[field] && Boolean(formik.errors[field])}
                      helperText={formik.touched[field] && formik.errors[field]}
                      multiline={field === 'notes'}
                      rows={field === 'notes' ? 3 : 1}
                    />
                  </Grid>
                )}
              </React.Fragment>
            ))}
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
                {isLoading ? 'Updating...' : 'Update Client'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Box>
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

export default EditClient;
