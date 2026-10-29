import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import axios from "axios";
import { Formik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { useAuth } from "../../auth/AuthContext";
import { formPageSx } from "../../styles/uiStyles";

const CreateNewUser = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState("success");
  const [alertMessage, setAlertMessage] = useState("");
  const isNonMobile = useMediaQuery("(min-width:600px)");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  

  const handleFormSubmit = async (values) => {
    try {
      const response = await axios.post(
        environment.apiUrl + "/auth/change-password",
        {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }
      );

      if (response.status === 200) {
        setAlertSeverity("success");
        setAlertMessage("Password changed successfully.");
        setOpenSnackbar(true);
        setTimeout(() => {
          setOpenSnackbar(false);
          logout().finally(() => navigate("/", { replace: true }));
        }, 2000);
      } else if (response.status === 400) {
        setAlertSeverity("error");
        setAlertMessage("Incorrect old password!");
        setOpenSnackbar(true);
      } else {
        setAlertSeverity("error");
        setAlertMessage("Failed to change password. Please try again.");
        setOpenSnackbar(true);
      }
    } catch (error) {
      console.error("API Error:", error);
      setAlertSeverity("error");
      setAlertMessage("InCorrect Old Password");
      setOpenSnackbar(true);
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

  return (
    <Box sx={{ ...formPageSx, maxWidth: 760 }}>
      <Header title="Change Password" subtitle="" />

      <Box>
        <Formik
          onSubmit={handleFormSubmit}
          initialValues={initialValues}
          validationSchema={checkoutSchema}
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
              <Box>
                <Box mb={2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type={showPassword ? "text" : "password"}
                    label="Current Password *"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.currentPassword}
                    name="currentPassword"
                    error={
                      !!touched.currentPassword && !!errors.currentPassword
                    }
                    helperText={
                      touched.currentPassword && errors.currentPassword
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {showPassword ? <Visibility /> : <VisibilityOff />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box mb={2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type={showNewPassword ? "text" : "password"}
                    label="New Password *"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.newPassword}
                    name="newPassword"
                    error={!!touched.newPassword && !!errors.newPassword}
                    helperText={touched.newPassword && errors.newPassword}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowNewPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {showNewPassword ? (
                              <Visibility />
                            ) : (
                              <VisibilityOff />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box mb={2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type={showConfirmPassword ? "text" : "password"}
                    label="Confirm Password *"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.confirmPassword}
                    name="confirmPassword"
                    error={
                      !!touched.confirmPassword && !!errors.confirmPassword
                    }
                    helperText={
                      touched.confirmPassword && errors.confirmPassword
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowConfirmPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {showConfirmPassword ? (
                              <Visibility />
                            ) : (
                              <VisibilityOff />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box display="flex" justifyContent="left" mt={3}>
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{
                      backgroundColor: "#6870fa",
                      color: "white",
                      fontSize: "16px",
                      "&:hover": {
                        backgroundColor: "#3e4396",
                      },
                    }}
                  >
                    Update
                  </Button>
                </Box>
              </Box>
            </form>
          )}
        </Formik>
      </Box>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={alertSeverity}
          elevation={6}
          variant="filled"
          style={{ color: "white" }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const checkoutSchema = yup.object().shape({
  currentPassword: yup.string().required("Current Password is required"),
  newPassword: yup
    .string()
    .required("New Password is required")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_+=\-/\[\]`~\\';])[A-Za-z\d!@#$%^&*(),.?":{}|<>_+=\-/\[\]`~\\';]{10,}$/,
      "New Password must be at least 10 characters, including one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword"), null], "Passwords must match")
    .required("Confirm Password is required")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_+=\-/\[\]`~\\';])[A-Za-z\d!@#$%^&*(),.?":{}|<>_+=\-/\[\]`~\\';]{10,}$/,
      "Confirm Password must be at least 10 characters, including one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

const initialValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default CreateNewUser;
