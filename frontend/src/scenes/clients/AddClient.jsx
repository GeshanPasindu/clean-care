import { getAccessToken } from "../../auth/apiClient";
import {
  Box,
  Button,
  MenuItem,
  Alert as MuiAlert,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import AlertTitle from "@mui/material/AlertTitle";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Formik } from "formik";
import React, { useState } from "react";
import * as yup from "yup";
import axios from "axios";
import Header from "../../components/Header";
import { environment } from '../../environment';
import { useNavigate } from "react-router";
import { formPageSx } from "../../styles/uiStyles";

const AddClient = ({ onClientAdded }) => {
  const isNonMobile = useMediaQuery("(min-width:600px)");
  const [loading, setLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("success");
  const navigate = useNavigate();

  const handleFormSubmit = async (values, { resetForm }) => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const response = await axios.post(
        environment.apiUrl+`/client/addClient`,
        values,
        { headers }
      );

      if (response.data.success) {
        setAlertSeverity("success");
        setAlertMessage("Client Added Successfully");
        resetForm();
        if (onClientAdded) {
          onClientAdded(response.data.client);
        }
        navigate('/clients');

      } else {
        setAlertSeverity("error");
        setAlertMessage(response.data.message);
      }
    } catch (error) {
      console.error("Error creating client:", error);
      setAlertSeverity("error");
      setAlertMessage("Failed to add client");
    } finally {
      setLoading(false);
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title="Add Client" subtitle="" />
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
          <AlertTitle>
            {alertSeverity === "success" ? "Success" : "Error"}
          </AlertTitle>
          {alertMessage}
        </MuiAlert>
      </Snackbar>
      <Formik
        onSubmit={handleFormSubmit}
        initialValues={initialValues}
        validationSchema={clientSchema}
      >
        {({
          values,
          errors,
          touched,
          handleBlur,
          handleChange,
          handleSubmit,
        }) => (
          <form onSubmit={handleSubmit}>
            <Box
              display="grid"
              gap="30px"
              gridTemplateColumns={
                isNonMobile ? "repeat(1, 1fr)" : "repeat(1, 1fr)"
              }
            >
              <Typography fontWeight="bold" fontSize="16px">
                First Name*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.firstName}
                  name="firstName"
                  error={!!touched.firstName && !!errors.firstName}
                  helperText={touched.firstName && errors.firstName}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Last Name*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.lastName}
                  name="lastName"
                  error={!!touched.lastName && !!errors.lastName}
                  helperText={touched.lastName && errors.lastName}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Email*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="email"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.email}
                  name="email"
                  error={!!touched.email && !!errors.email}
                  helperText={touched.email && errors.email}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Address*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.address}
                  name="address"
                  error={!!touched.address && !!errors.address}
                  helperText={touched.address && errors.address}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Phone Number*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.phoneNumber}
                  name="phoneNumber"
                  error={!!touched.phoneNumber && !!errors.phoneNumber}
                  helperText={touched.phoneNumber && errors.phoneNumber}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Contact Name
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.contactName}
                  name="contactName"
                  error={!!touched.contactName && !!errors.contactName}
                  helperText={touched.contactName && errors.contactName}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Contact Phone Number
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.contactPhoneNumber}
                  name="contactPhoneNumber"
                  error={!!touched.contactPhoneNumber && !!errors.contactPhoneNumber}
                  helperText={touched.contactPhoneNumber && errors.contactPhoneNumber}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Contact Email
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="email"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.contactEmail}
                  name="contactEmail"
                  error={!!touched.contactEmail && !!errors.contactEmail}
                  helperText={touched.contactEmail && errors.contactEmail}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Account Manager
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.accountManager}
                  name="accountManager"
                  error={!!touched.accountManager && !!errors.accountManager}
                  helperText={touched.accountManager && errors.accountManager}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Notes
              </Typography>
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

const initialValues = {
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
};

export default AddClient;
