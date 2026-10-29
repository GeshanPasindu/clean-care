import { getAccessToken } from "../../auth/apiClient";
import { Box, Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import axios from "axios";
import { environment } from '../../environment';
import { Link } from "react-router-dom";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx, pageHeaderRowSx } from "../../styles/uiStyles";


const ViewClient = () => {
  const { id } = useParams();
  const [clientDetails, setClientDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    phoneNumber: "",
    contactName: "",
    contactPhoneNumber: "",
    contactEmail: "",
    accountManager: "",
    notes: "",
    clientStatus: "",
  });

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  const token = getAccessToken();

  const fetchClientDetails = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(environment.apiUrl + `/client/getClientById/${id}`, { headers });
      const responseData = response.data;
      if (responseData.success) {
        const { client } = responseData;
        setClientDetails(client);
      } else {
        console.error("Failed to fetch client details:");
      }
    } catch (error) {
      console.error("Error fetching client details:", error);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Client details" subtitle={[clientDetails.firstName, clientDetails.lastName].filter(Boolean).join(" ")} />
        <Link to={`/clients/viewClient/${id}/jobs`} style={{ textDecoration: "none" }}>
          <Button variant="contained">
            View Client Jobs
          </Button>
        </Link>
      </Box>
      <DetailGrid data={clientDetails} exclude={["_id", "createdAt", "__v", "updatedAt", "adminId"]} />
    </Box>
  );
};

export default ViewClient;
