import { Avatar, Box, Button, Typography, useTheme } from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import axios from "axios";

const Profile = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [adminData, setAdminData] = useState({});
  useEffect(() => {
    const getAdminData = async () => {
      await axios
        .get("https://jcgnapi.hasthiya.org/admin/getAdmin")
        .then((res) => {
          console.log(res.data);
          setAdminData(res.data[0])
        })
        .catch((err) => {
          console.log(err);
        });
    };
    getAdminData();
  }, []);

  // State to store user details fetched from API
  const [userDetails, setUserDetails] = useState({
    Name: "",
    "Email Address": "",
    ProfileImage: "",
  });

  useEffect(() => {
    // Fetch user details from API
    fetch("https://jcgnapi.hasthiya.org/admin/getAdmin")
      .then((response) => response.json())
      .then((data) => {
        const userData = data[0]; 
        setUserDetails({
          Name: userData.name,
          "Email Address": userData.email,
          ProfileImage: userData.image,
        });
      })
      .catch((error) => {
        console.error("Error fetching user details:", error);
      });
  }, []);

  return (
    <Box m="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="20px">
        <Header title="My Profile" subtitle="" />
        <Box>
          <Link to={"changepassword"} style={{ marginRight: "10px" }}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#6870fa",
                color: "white",
                fontSize: "16px",
                "&:hover": {
                  backgroundColor: "#3e4396",
                },
              }}>
              Change Password
            </Button>
          </Link>
          <Link to={"editprofile"}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#6870fa",
                color: "white",
                fontSize: "16px",
                "&:hover": {
                  backgroundColor: "#3e4396",
                },
              }}>
              Edit Profile
            </Button>
          </Link>
        </Box>
      </Box>
      <Box display="flex" alignItems="center">
        <Avatar
          alt="User Avatar"
          src={userDetails.ProfileImage} // Use fetched profile picture
          sx={{ width: 200, height: 200, marginRight: "20px" }}
        />

        <Box>
          <Typography variant="h3" gutterBottom>
            {userDetails.Name} {/* Display fetched name */}
          </Typography>
          <Typography variant="h4" gutterBottom>
            {userDetails["Email Address"]} {/* Display fetched email */}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Profile;
