import { getAccessToken } from "../../auth/apiClient";
import React, { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useParams } from "react-router-dom";
import axios from "axios";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { pageContainerSx } from "../../styles/uiStyles";
import InvoicePreview from "./InvoicePreview";

const ViewInvoice = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const token = getAccessToken();

  useEffect(() => {
    let isCurrent = true;
    const fetchInvoiceDetails = async () => {
      try {
        const response = await axios.get(`${environment.apiUrl}/invoice/getInvoiceById/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isCurrent && response.data.success) setInvoice(response.data.invoice);
        else if (isCurrent) setLoadError(true);
      } catch (error) {
        console.error("Error fetching invoice details:", error);
        if (isCurrent) setLoadError(true);
      }
    };

    fetchInvoiceDetails();
    return () => { isCurrent = false; };
  }, [id, token]);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          .invoice-print-area, .invoice-print-area * { visibility: visible !important; }
          .invoice-print-area {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
        <Box className="no-print" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
          <Header title="Invoice" subtitle="Printable invoice details" />
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={!invoice}
            sx={{ whiteSpace: "nowrap" }}
          >
            Print invoice
          </Button>
        </Box>
        {invoice ? (
          <InvoicePreview invoice={invoice} client={invoice.client} invoiceNumber={invoice._id} />
        ) : (
          <Typography color={loadError ? "error" : "text.secondary"}>
            {loadError ? "Unable to load this invoice." : "Loading invoice..."}
          </Typography>
        )}
      </Box>
    </>
  );
};

export default ViewInvoice;
