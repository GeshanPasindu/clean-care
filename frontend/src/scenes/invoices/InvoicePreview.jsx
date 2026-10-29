import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import logo from "../../assets/logo/logo.png";

const formatInvoiceDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "LKR 0.00";
  return `LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const InvoicePreview = ({ invoice = {}, client, invoiceNumber, preview = false }) => {
  const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ");

  return (
    <Box
      className={preview ? "invoice-preview-box" : "invoice-print-area"}
      sx={preview
        ? {
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: { xs: 2, sm: 2.5 },
            alignSelf: "start",
          }
        : { width: "100%" }}
    >
      {preview && (
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
          Live invoice preview
        </Typography>
      )}
      <Box
        sx={{
          bgcolor: "#fff",
          color: "#15233b",
          border: preview ? "1px solid #e2e7ef" : "none",
          borderRadius: preview ? 2 : 0,
          boxShadow: preview ? "0 5px 18px rgba(24, 39, 75, 0.08)" : "none",
          p: { xs: 2.5, sm: 4 },
          minHeight: preview ? 520 : "auto",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Box
              component="img"
              src={logo}
              alt="Clean Care logo"
              sx={{ display: "block", width: 140, maxHeight: 55, objectFit: "contain", objectPosition: "left center", mb: 1 }}
            />
            <Typography variant="h5" fontWeight={800} color="#162440">
              Clean Care
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", minWidth: 110 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={700}>
              INVOICE
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
              {invoiceNumber || "Draft"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Send date: {formatInvoiceDate(invoice.sendDate)}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 3, borderColor: "#dce3ed" }} />

        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={3} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              BILL TO
            </Typography>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
              {clientName || "Client name"}
            </Typography>
            {client?.address && <Typography variant="body2" color="text.secondary">{client.address}</Typography>}
            {client?.email && <Typography variant="body2" color="text.secondary">{client.email}</Typography>}
            {client?.phoneNumber && <Typography variant="body2" color="text.secondary">{client.phoneNumber}</Typography>}
            {!client && <Typography variant="body2" color="text.secondary">Select a client to show billing details.</Typography>}
          </Box>
          <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              STATUS
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
              {invoice.invoiceStatus || "Draft"}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>
          {invoice.invoiceTitle || "Invoice title"}
        </Typography>
        <Box sx={{ borderTop: "1px solid #dce3ed", borderBottom: "1px solid #dce3ed", py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Description</Typography>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Amount</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start" sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", flex: 1 }}>
              {invoice.invoiceDescription || "Invoice description"}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>
              {formatAmount(invoice.amount)}
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" justifyContent="flex-end" spacing={4} sx={{ py: 2 }}>
          <Typography variant="body1" fontWeight={700}>Total</Typography>
          <Typography variant="h6" fontWeight={800} sx={{ minWidth: 115, textAlign: "right" }}>
            {formatAmount(invoice.amount)}
          </Typography>
        </Stack>
        {invoice.notes && (
          <Box sx={{ borderTop: "1px solid #dce3ed", pt: 2, mt: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>NOTES</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{invoice.notes}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default InvoicePreview;
