import { getAccessToken } from "../../auth/apiClient";
import { Box, Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../../components/Header";
import axios from "axios";
import { environment } from "../../environment";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx, pageHeaderRowSx } from "../../styles/uiStyles";

const ViewStaff = () => {
  const { id } = useParams();
  const [staffDetails, setStaffDetails] = useState({
    firstName: "",
    lastName: "",
    address: "",
    email: "",
    phoneNumber: "",
    position: "",
    dateOfBirth: "",
    dateOfHire: "",
    empContactName: "",
    empPhoneNumber: "",
    bankAcNo: "",
    bankName: "",
    bankAcBranch: "",
    notes: "",
    workStatus: "",
    supervisorName: "",
  });
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetchStaffDetails();
  }, [id]);

  const token = getAccessToken();

  const fetchStaffDetails = async () => {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      const response = await axios.get(environment.apiUrl + `/staff/getStaffById/${id}`, { headers });
      const responseData = response.data;
      console.log("Staff Details:", responseData);
      if (responseData.success) {
        const { staff } = responseData;
        setStaffDetails(staff);
        fetchUserEmail(staff.user); // Fetch the user email
      } else {
        console.error("Failed to fetch staff details:");
      }
    } catch (error) {
      console.error("Error fetching staff details:", error);
    }
  };

  const fetchUserEmail = async (userId) => {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      const response = await axios.get(environment.apiUrl + `/user/getUser/${userId}`, { headers });
      const responseData = response.data;
      console.log("User Details:", responseData);
      if (responseData.success) {
        setUserEmail(responseData.userDetails.email);
      } else {
        console.error("Failed to fetch user email:");
      }
    } catch (error) {
      console.error("Error fetching user email:", error);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Staff details" subtitle={[staffDetails.firstName, staffDetails.lastName].filter(Boolean).join(" ")} />
        <Link to={`/staff/viewstaff/${id}/jobs`} style={{ textDecoration: "none" }}>
          <Button variant="contained">
            View Staff Jobs
          </Button>
        </Link>
      </Box>
      <DetailGrid
        data={{ ...staffDetails, email: userEmail }}
        exclude={["_id", "createdAt", "__v", "updatedAt", "user", "adminId"]}
      />
    </Box>
  );
};

export default ViewStaff;
