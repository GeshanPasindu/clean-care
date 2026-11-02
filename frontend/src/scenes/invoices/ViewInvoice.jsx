import React from "react";
import { Box, Button, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import { pageContainerSx } from "../../styles/uiStyles";
import InvoicePreview from "./InvoicePreview";
import { useInvoice } from "./invoiceQueries";

const ViewInvoice = () => {
  const { id } = useParams();
  const invoiceQuery = useInvoice(id);
  const invoice = invoiceQuery.data?.invoice || null;

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
          <Typography color={invoiceQuery.isError ? "error" : "text.secondary"}>
            {invoiceQuery.isError ? "Unable to load this invoice." : "Loading invoice..."}
          </Typography>
        )}
      </Box>
    </>
  );
};

export default ViewInvoice;
