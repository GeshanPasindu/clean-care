import { CameraAlt, Delete } from "@mui/icons-material";
import {
  Alert,
  AlertTitle,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useFormik } from "formik";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import * as yup from "yup";
import Header from "../../components/Header";
import axios from "axios";
import { environment } from "../../environment";
import { useAuth } from "../../auth/AuthContext";
import { formPageSx, pageHeaderRowSx } from "../../styles/uiStyles";

function EditProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    ProfileImage: "",
  });
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState("success");
  const [alertMessage, setAlertMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      const response = await axios.get(
        environment.apiUrl + `/user/getUser/${userId}`
      );
      if (response) {
        const data = await response.data;
        const userData = data.userDetails;
        setUserDetails({
          name: userData.userName ? userData.userName : " " ,
          email: userData.email ? userData.email : " ",
          ProfileImage: userData.image || "",
        });

        formik.setValues({
          name: userData.userName ? userData.userName : " " ,
          email: userData.email ? userData.email : " ",
        });
      } else {
        console.error("Failed to fetch user details:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  const checkoutSchema = yup.object().shape({
    name: yup.string().required("Name is required"),
    email: yup.string().required("Email is required").email("Enter valid mail")
  });

  const formik = useFormik({
    initialValues: userDetails,
    validationSchema: () => checkoutSchema,
    onSubmit: async (values) => {
      try {
        // const response = await fetch(
        //   `https://jcgnapi.hasthiya.org/admin/updateUserDetails/1`,
        //   {
        //     method: "PUT",
        //     headers: {
        //       "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify({
        //       email: userDetails.email,
        //       name: values.name,
        //     }),
        //   }
        // );
        const userValues ={
        userName : values.name,
        email : values.email

        }
    
        const response = await axios.put(environment.apiUrl+`/user/userUpdate/${userId}`, userValues);
        if (response.data.success) {
          updateUser({ userName: userValues.userName, email: userValues.email });
          setAlertSeverity("success");
          setAlertMessage("Profile name updated successfully!");
          setOpenSnackbar(true);
          setTimeout(() => {
            navigate("/profile");
          }, 2000);
          fetchUserDetails();
          setHasChanges(false);
        } else {
          console.error("Failed to update profile:", response.statusText);
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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserDetails({
          ...userDetails,
          ProfileImage: reader.result,
        });

        uploadProfileImage(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfileImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append("imageURL", file);
      const response = await fetch(
        `https://jcgnapi.hasthiya.org/admin/updateAdminImage/1`,
        {
          method: "PUT",
          body: formData,
        }
      );
      if (response.ok) {
        setAlertSeverity("success");
        setAlertMessage("Image changed successfully!");
        setTimeout(() => {
          navigate("/profile");
        }, 2000);
        setOpenSnackbar(true);
      } else {
        console.error("Failed to update profile image:", response.statusText);
      }
    } catch (error) {
      console.error("Error updating profile image:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeProfileImage = () => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will remove the profile picture. Continue?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6870fa",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, remove it!",
    }).then((result) => {
      if (result.isConfirmed) {
        handleRemoveImage();
      }
    });
  };

  const handleRemoveImage = async () => {
    try {
      const defaultAvatar = await fetch("./avatar.png");
      const avatarBlob = await defaultAvatar.blob();

      const formData = new FormData();
      formData.append("imageURL", avatarBlob);

      const response = await fetch(
        `https://jcgnapi.hasthiya.org/admin/updateAdminImage/1`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (response.ok) {
        console.log("Profile image updated successfully!");
        setAlertSeverity("success");
        setAlertMessage("Profile picture removed successfully!");
        setOpenSnackbar(true);

        setUserDetails({
          ...userDetails,
          ProfileImage: "./avatar.png",
        });
      } else {
        console.error("Failed to remove profile image:", response.statusText);
        setAlertSeverity("error");
        setAlertMessage("Failed to remove profile picture. Please try again.");
        setOpenSnackbar(true);
      }
    } catch (error) {
      console.error("Error removing profile image:", error);
      setAlertSeverity("error");
      setAlertMessage(
        "An error occurred while removing profile picture. Please try again later."
      );
      setOpenSnackbar(true);
    }
  };

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
          <Button type="submit" variant="contained" disabled={!hasChanges}>
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
