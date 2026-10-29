import { getAccessToken } from "../../auth/apiClient";
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Snackbar,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MuiAlert from '@mui/material/Alert';
import axios from 'axios';
import { useNavigate, useParams } from "react-router-dom";
import { Formik, Field, Form } from 'formik';
import * as yup from 'yup';
import Header from "../../components/Header";
import { environment } from "../../environment";
import { formPageSx } from "../../styles/uiStyles";

// Validation schema
const adminSchema = yup.object().shape({
  firstName: yup.string().required("First Name is required"),
  lastName: yup.string().required("Last Name is required"),
  email: yup.string().email("Invalid email format").required("Email is required"),
  userName: yup.string().required("Username is required"),
  position: yup.string().required("Position is required"),
});

const EditAdmin = () => {
  const { id } = useParams();
  const token = getAccessToken();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [adminDetails, setAdminDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    userName: "",
  });

  const [passwordDetails, setPasswordDetails] = useState({
    password: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [admin, setAdmin] = useState('');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');
  const adminName = [adminDetails.firstName, adminDetails.lastName].filter(Boolean).join(" ") || adminDetails.userName;

  useEffect(() => {
    fetchAdminDetails();
  }, [id]);

  const fetchAdminDetails = async () => {
    try {
      const response = await axios.get(`${environment.apiUrl}/user/getUser/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const responseData = response.data.userDetails;
      if (responseData) {
        const adminData = responseData.adminDetails;
        setAdmin(adminData._id);
        setAdminDetails({
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          email: responseData.email,
          position: adminData.position,
          userName: responseData.userName,
        });
      } else {
        console.error('Failed to fetch admin details:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching admin details:', error);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordDetails(prevDetails => ({
      ...prevDetails,
      [name]: value,
    }));
    if (name === "password") {
      setPasswordError("");
    }
    if (name === "confirmPassword") {
      setConfirmPasswordError("");
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleClickShowNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const handleClickShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const validatePassword = (password) => {
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
    return passwordPattern.test(password);
  };

  const handleUpdateAdmin = async (values) => {
    setIsLoading(true);

    try {
      const response = await axios.put(`${environment.apiUrl}/user/updateAdmin/${admin}`, values, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.status === 200) {
        setAdminDetails(values);
        setAlertSeverity('success');
        setAlertMessage('Admin account updated successfully');
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      } else {
        console.error(response);
        setAlertSeverity('error');
        setAlertMessage(`Failed to update admin: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error updating admin:', error);
      setAlertSeverity('error');
      setAlertMessage(`Error updating admin: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOpenSnackbar(true);
    }
  };

  const handleUpdatePassword = async () => {
    let isValid = true;

    if (!passwordDetails.password) {
      setPasswordError("Please enter a valid password");
      isValid = false;
    } else if (!validatePassword(passwordDetails.password)) {
      setPasswordError("Password should be at least 10 characters long and contain at least one uppercase letter, one lowercase letter, one number");
      isValid = false;
    }

    if (passwordDetails.password !== passwordDetails.confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      isValid = false;
    }

    if (!isValid) {
      setOpenSnackbar(true);
      return;
    }

    try {
      const response = await axios.put(`${environment.apiUrl}/admin/updateAdminPassword/${id}`, { password: passwordDetails.password }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.status === 200) {
        setAlertMessage('Password updated successfully');
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      } else {
        setAlertSeverity('error');
        setAlertMessage(`Failed to update password: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setAlertSeverity('error');
      setAlertMessage(`Error updating password: ${error.message}`);
    } finally {
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title={adminName ? `Edit Admin: ${adminName}` : "Edit Admin"} subtitle="" />
      <Box>
        <Formik
          initialValues={adminDetails}
          validationSchema={adminSchema}
          enableReinitialize={true}
          onSubmit={handleUpdateAdmin}
        >
          {({ values, handleChange, handleBlur, errors, touched }) => (
            <Form>
              <Grid container spacing={2}>
                {/* Render fields */}
                {Object.entries(values).map(([field, value]) => (
                  <React.Fragment key={field}>
                    <Grid item xs={12}>
                      <Typography variant="h5" component="span" fontWeight="bold">
                        {`${field.charAt(0).toUpperCase() + field.slice(1)}:`}
                      </Typography>
                      <TextField
                        fullWidth
                        variant="filled"
                        margin="normal"
                        name={field}
                        value={value}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched[field] && !!errors[field]}
                        helperText={touched[field] && errors[field]}
                        multiline={field === 'notes'}
                        rows={field === 'notes' ? 3 : 1}
                      />
                    </Grid>
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
                    {isLoading ? 'Updating...' : 'Update Admin'}
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
        {/* Password update fields */}
        <Grid container spacing={2} mt={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="h5" component="span" fontWeight="bold">
              Update Password:
            </Typography>
            <TextField
              fullWidth
              variant="filled"
              margin="normal"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={passwordDetails.password}
              onChange={handlePasswordChange}
              error={!!passwordError}
              helperText={passwordError}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              variant="filled"
              margin="normal"
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordDetails.confirmPassword}
              onChange={handlePasswordChange}
              error={!!confirmPasswordError}
              helperText={confirmPasswordError}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleClickShowConfirmPassword}
                      onMouseDown={handleMouseDownPassword}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpdatePassword}
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
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </Grid>
        </Grid>
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
          style={{ color: 'white' }}
        >
          {alertSeverity === 'success' ? 'Success' : 'Error'}
          {': '}
          {alertMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default EditAdmin;
