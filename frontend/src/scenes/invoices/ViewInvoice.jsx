import { getAccessToken } from "../../auth/apiClient";
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../../components/Header';
import { environment } from '../../environment';
import DetailGrid from '../../components/DetailGrid';
import { pageContainerSx } from '../../styles/uiStyles';

const ViewInvoice = () => {
  const { id } = useParams();
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceTitle: "",
    invoiceDescription: "",
    sendDate: "",
    client: {
      firstName: "",
      lastName: "",
      email: "",
    },
    amount: "",
    invoiceStatus: "",
  });
  const token = getAccessToken();

  useEffect(() => {
    fetchInvoiceDetails();
  }, [id]);

  const fetchInvoiceDetails = async () => {
    try {

       
      const response = await axios.get(environment.apiUrl + `/invoice/getInvoiceById/${id}`,{
        headers: {
            Authorization: `Bearer ${token}`
          }
      });
      const responseData = response.data;
      if (responseData.success) {
        const { invoice } = responseData;
        const { invoiceTitle, invoiceDescription, sendDate, client, amount, invoiceStatus } = invoice;
        const formattedClient = {
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
        };
        setInvoiceDetails({
          invoiceTitle,
          invoiceDescription,
          sendDate,
          client: formattedClient,
          amount,
          invoiceStatus,
        });
      } else {
        console.error('Failed to fetch invoice details:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
      <Header title="Invoice details" subtitle={`Invoice ID: ${id}`} />
      <DetailGrid data={invoiceDetails} />
    </Box>
  );
};

export default ViewInvoice;
