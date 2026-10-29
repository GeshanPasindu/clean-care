import { getAccessToken } from "../../auth/apiClient";
import { Box } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import axios from "axios";
import { environment } from "../../environment";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx } from "../../styles/uiStyles";

const ViewAdmin = () => {
  const { id } = useParams();
  const [adminDetails, setAdminDetails] = useState({
    firstName: "",
    lastName: "",
    position: "",
    userName: '',
    email: '',
    Status: "",
  });

  useEffect(() => {
    fetchAdminDetails();
  }, [id]);
  
  const token = getAccessToken()

  const fetchAdminDetails = async () => {
    try {
        const headers = {
            Authorization: `Bearer ${token}`
          };
      const response = await axios.get(environment.apiUrl+`/user/getUser/${id}`, { headers });
      const responseData = response.data.userDetails;
      if (responseData) {
        const userdata = responseData;
        const adminData = responseData.adminDetails
        setAdminDetails({
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          position: adminData.position,
          userName: userdata.userName,
          email: userdata.email,
          Status: userdata.status,
        });
        
      } else {
        console.error("Failed to fetch admin details:");
      }
    } catch (error) {
      console.error("Error fetching admin details:", error);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
      <Header title="Administrator details" subtitle={[adminDetails.firstName, adminDetails.lastName].filter(Boolean).join(" ") || adminDetails.userName} />
      <DetailGrid data={adminDetails} exclude={["_id"]} />
    </Box>
  );
};

export default ViewAdmin;
