import { Avatar, Box, Button, Typography } from "@mui/material";
import React from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { useAuth } from "../../auth/AuthContext";
import profileAvatar from "../../assets/logo/profile.png";

const Profile = () => {
  const { user } = useAuth();

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
          alt={`${user?.userName || "User"} avatar`}
          src={profileAvatar}
          sx={{ width: 200, height: 200, marginRight: "20px" }}
        />

        <Box>
          <Typography variant="h3" gutterBottom>
            {user?.userName || ""}
          </Typography>
          <Typography variant="h4" gutterBottom>
            {user?.email || ""}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Profile;
