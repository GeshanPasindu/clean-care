import { getAccessToken } from "../../auth/apiClient";
import {
  Box,
  Button,
  Snackbar,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Formik } from "formik";
import React, { useState } from "react";
import * as yup from "yup";
import axios from "axios";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { useNavigate } from "react-router";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { formPageSx } from "../../styles/uiStyles";

const CreateAdmin = ({ onStaffAdded }) => {
  const isNonMobile = useMediaQuery("(min-width:600px)");
  const [loading, setLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("success");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword(!showPassword);
  const handleMouseDownPassword = (event) => event.preventDefault();

  const handleFormSubmit = async (values, { resetForm }) => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const response = await axios.post(
        environment.apiUrl + `/user/adduser`,
        {
          email: values.email,
          password: values.password,
          userName: values.userName,
          role: "admin",
          adminDetails: values,
        },
        { headers }
      );

      if (response.data.success) {
        setAlertSeverity("success");
        setAlertMessage("Admin Added Successfully");
        resetForm();
        if (onStaffAdded) {
          onStaffAdded(response.data.staff);
        }
        navigate('/admin');
      } else {
        setAlertSeverity("error");
        setAlertMessage(response.data.message);
      }
    } catch (error) {
      console.error("Error creating Admin:", error);
      setAlertSeverity("error");
      setAlertMessage("Failed to add admin");
    } finally {
      setLoading(false);
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title="Create Admin" subtitle="" />
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
        validationSchema={staffSchema}
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
                Password*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type={showPassword ? "text" : "password"}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.password}
                  name="password"
                  error={!!touched.password && !!errors.password}
                  helperText={touched.password && errors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Username*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.userName}
                  name="userName"
                  error={!!touched.userName && !!errors.userName}
                  helperText={touched.userName && errors.userName}
                />
              </Box>
              <Typography fontWeight="bold" fontSize="16px">
                Position*
              </Typography>
              <Box mt={-2}>
                <TextField
                  fullWidth
                  variant="filled"
                  type="text"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.position}
                  name="position"
                  error={!!touched.position && !!errors.position}
                  helperText={touched.position && errors.position}
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

const staffSchema = yup.object().shape({
  firstName: yup.string().required("First Name is required"),
  lastName: yup.string().required("Last Name is required"),
  email: yup.string().email("Invalid email format").required("Email is required"),
  password: yup.string().min(10, "Password must be at least 10 characters").max(128).required("Password is required"),
  userName: yup.string().required("Username is required"),
  position: yup.string().required("Position is required"),
});

const initialValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  userName: "",
  position: "",
};

export default CreateAdmin;
