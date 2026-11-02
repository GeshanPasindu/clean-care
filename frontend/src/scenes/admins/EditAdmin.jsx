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
import { useNavigate, useParams } from "react-router-dom";
import { Formik, Field, Form } from 'formik';
import * as yup from 'yup';
import Header from "../../components/Header";
import { formPageSx } from "../../styles/uiStyles";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { adminService } from "../../services/adminService";
import { userService } from "../../services/userService";

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
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');
  const adminName = [adminDetails.firstName, adminDetails.lastName].filter(Boolean).join(" ") || adminDetails.userName;
  const adminQuery = useServiceQuery(
    ["users", "detail", id],
    () => userService.getById(id),
    { enabled: Boolean(id) }
  );
  const updateAdminMutation = useServiceMutation(
    ({ adminId, values }) => userService.updateAdmin(adminId, values),
    { invalidate: [["admins"], ["users", "detail", id]] }
  );
  const updatePasswordMutation = useServiceMutation(
    ({ userId, password }) => adminService.updatePassword(userId, password)
  );

  useEffect(() => {
    const userData = adminQuery.data?.userDetails;
    if (!userData?.adminDetails) return;
    const adminData = userData.adminDetails;
    setAdmin(adminData._id);
    setAdminDetails({
      firstName: adminData.firstName || "",
      lastName: adminData.lastName || "",
      email: userData.email || "",
      position: adminData.position || "",
      userName: userData.userName || "",
    });
  }, [adminQuery.data]);

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
    try {
      await updateAdminMutation.mutateAsync({ adminId: admin, values });
      setAdminDetails(values);
      setAlertSeverity('success');
      setAlertMessage('Admin account updated successfully');
      setTimeout(() => {
        navigate('/admin');
      }, 2000);
    } catch (error) {
      console.error('Error updating admin:', error);
      setAlertSeverity('error');
      setAlertMessage(`Error updating admin: ${error.message}`);
    } finally {
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
      await updatePasswordMutation.mutateAsync({ userId: id, password: passwordDetails.password });
      setAlertMessage('Password updated successfully');
      setTimeout(() => {
        navigate('/admin');
      }, 2000);
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
                    disabled={updateAdminMutation.isPending}
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
