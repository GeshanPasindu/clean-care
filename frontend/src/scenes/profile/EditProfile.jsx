import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Grid,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useFormik } from "formik";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import { formPageSx, pageHeaderRowSx } from "../../styles/uiStyles";
import { useServiceMutation } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";

function EditProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState("success");
  const [alertMessage, setAlertMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const userId = user?.id;
  const updateProfile = useServiceMutation(
    ({ id, values }) => userService.updateProfile(id, values),
    { invalidate: [["users", "detail", userId]] }
  );

  const checkoutSchema = yup.object().shape({
    name: yup.string().required("Name is required"),
    email: yup.string().required("Email is required").email("Enter valid mail")
  });

  const formik = useFormik({
    initialValues: {
      name: user?.userName || "",
      email: user?.email || "",
    },
    enableReinitialize: true,
    validationSchema: () => checkoutSchema,
    onSubmit: async (values) => {
      try {
        const userValues = {
          userName: values.name,
          email: values.email,
        };

        const response = await updateProfile.mutateAsync({ id: userId, values: userValues });
        if (response.success) {
          updateUser({ userName: userValues.userName, email: userValues.email });
          setAlertSeverity("success");
          setAlertMessage("Profile name updated successfully!");
          setOpenSnackbar(true);
          setTimeout(() => {
            navigate("/profile");
          }, 2000);
          setHasChanges(false);
        } else {
          console.error("Failed to update profile:", response.message);
          setAlertSeverity("error");
          setAlertMessage("Failed to update profile. Please try again.");
          setOpenSnackbar(true);

        }
      } catch (error) {
        console.error("Error updating profile:", error);
        setAlertSeverity("error");
        setAlertMessage(
          "An error occurred while updating profile. Please try again later."
        );
        setOpenSnackbar(true);
      }
    },
  });

  const handleInputChange = (event) => {
    formik.handleChange(event);
    setHasChanges(true); // Set hasChanges to true when input changes
  };

  return (
    <Box sx={{ ...formPageSx, maxWidth: 900 }}>
      <Box sx={pageHeaderRowSx}>
        <Header title="My profile" subtitle="Manage your account information" />
        <Button variant="outlined" onClick={() => navigate("/profile/changepassword")}>
          Change password
        </Button>
      </Box>

      <Box component="form" onSubmit={formik.handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography component="label" htmlFor="profile-name" sx={{ display: "block", mb: 0.75, fontWeight: 600 }}>
              Display name
            </Typography>
            <TextField
              fullWidth
              id="profile-name"
              name="name"
              value={formik.values.name}
              onChange={handleInputChange}
              onBlur={formik.handleBlur}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography component="label" htmlFor="profile-email" sx={{ display: "block", mb: 0.75, fontWeight: 600 }}>
              Email address
            </Typography>
            <TextField
              fullWidth
              id="profile-email"
              name="email"
              type="email"
              value={formik.values.email}
              onChange={handleInputChange}
              onBlur={formik.handleBlur}
              error={formik.touched.email && Boolean(formik.errors.email)}
              helperText={formik.touched.email && formik.errors.email}
            />
          </Grid>
        </Grid>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button type="submit" variant="contained" disabled={!hasChanges || updateProfile.isPending}>
            Save changes
          </Button>
        </Box>
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
          <AlertTitle>
            {alertSeverity === "success" ? "Success" : "Error"}
          </AlertTitle>
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default EditProfile;
