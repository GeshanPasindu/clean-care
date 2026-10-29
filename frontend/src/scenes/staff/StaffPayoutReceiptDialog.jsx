import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import axios from "axios";
import { getAccessToken } from "../../auth/apiClient";
import { environment } from "../../environment";
import logo from "../../assets/logo/logo.png";

const paymentMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

const todayInputDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const formatAmount = (value) => `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const getStaffName = (assignment, staffName, receipt) => {
  const staff = assignment?.staff;
  return receipt?.payeeName
    || [staff?.firstName, staff?.lastName].filter(Boolean).join(" ")
    || staffName
    || "Staff member";
};

const StaffPayoutReceiptDocument = ({ job, assignment, staffName, receipt, draft }) => (
  <Box className="staff-payout-print-area" sx={{ bgcolor: "#fff", color: "#15233b", p: { xs: 2.5, sm: 4 }, minHeight: 500 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Box>
        <Box component="img" src={logo} alt="Business logo" sx={{ display: "block", width: 140, maxHeight: 55, objectFit: "contain", objectPosition: "left center", mb: 1 }} />
        <Typography variant="h5" fontWeight={800} color="#162440">Clean Care</Typography>
      </Box>
      <Box sx={{ textAlign: "right", minWidth: 130 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>STAFF PAYMENT RECEIPT</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
          {draft ? "Draft - not recorded" : receipt?._id || "Receipt"}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          Date paid: {formatDate(receipt?.paymentDate)}
        </Typography>
      </Box>
    </Stack>
    <Divider sx={{ my: 3, borderColor: "#dce3ed" }} />
    <Typography variant="caption" color="text.secondary" fontWeight={700}>PAID TO</Typography>
    <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>{getStaffName(assignment, staffName, receipt)}</Typography>
    {(receipt?.payeeEmail || assignment?.staff?.email) && (
      <Typography variant="body2" color="text.secondary">{receipt?.payeeEmail || assignment.staff.email}</Typography>
    )}
    {(receipt?.payeePhoneNumber || assignment?.staff?.phoneNumber) && (
      <Typography variant="body2" color="text.secondary">{receipt?.payeePhoneNumber || assignment.staff.phoneNumber}</Typography>
    )}
    <Box sx={{ mt: 3, borderTop: "1px solid #dce3ed", borderBottom: "1px solid #dce3ed", py: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>WORK DETAILS</Typography>
      <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>{receipt?.jobName || job?.jobName || "Job"}</Typography>
      <Typography variant="body2" color="text.secondary">Job date: {formatDate(receipt?.jobDate || job?.jobDate)}</Typography>
      <Typography variant="body2" color="text.secondary">Hours: {Number(receipt?.hours ?? assignment?.hours ?? 0).toFixed(2)}</Typography>
      <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">Payment method</Typography>
        <Typography variant="body2" fontWeight={600}>{receipt?.method || "Not selected"}</Typography>
      </Stack>
      {receipt?.referenceNumber && (
        <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">Payment reference</Typography>
          <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere", textAlign: "right" }}>{receipt.referenceNumber}</Typography>
        </Stack>
      )}
    </Box>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 2 }}>
      <Typography variant="body1" fontWeight={700}>Amount paid</Typography>
      <Typography variant="h5" fontWeight={800}>{formatAmount(receipt?.amount)}</Typography>
    </Stack>
    {draft && <Typography variant="caption" color="text.secondary">This preview is not a receipt until the payout is recorded.</Typography>}
  </Box>
);

const StaffPayoutReceiptDialog = ({ open, job, assignment, staffName, canRecord, onClose, onPaymentSaved }) => {
  const token = getAccessToken();
  const receipts = assignment?.payoutReceipts || [];
  const amountDue = Number(assignment?.payment || 0);
  const paidTotal = useMemo(
    () => receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0) + Number(assignment?.payoutBatchTotal || 0),
    [assignment?.payoutBatchTotal, receipts]
  );
  const legacyPaid = assignment?.paymentStatus === "Done" && receipts.length === 0 && Number(assignment?.payoutBatchTotal || 0) === 0;
  const balance = legacyPaid ? 0 : Math.max(0, amountDue - paidTotal);
  const [values, setValues] = useState({ amount: "", paymentDate: todayInputDate(), method: "Cash", referenceNumber: "" });
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedReceipt(null);
      return;
    }
    if (!selectedReceipt) {
      setErrorMessage("");
      setValues({
        amount: legacyPaid ? amountDue.toFixed(2) : balance > 0 ? balance.toFixed(2) : "",
        paymentDate: todayInputDate(),
        method: "Cash",
        referenceNumber: "",
      });
    }
  }, [open, job?._id, balance, amountDue, legacyPaid, selectedReceipt]);

  const handleChange = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrorMessage("");
  };

  const handleRecordPayment = async () => {
    const staffId = assignment?.staff?._id || assignment?.staff;
    if (!staffId) {
      setErrorMessage("The staff assignment could not be identified.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      const response = await axios.post(
        `${environment.apiUrl}/job/${job._id}/staff/${staffId}/payoutReceipts`,
        { ...values, legacyReceiptOnly: legacyPaid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedAssignment = {
        ...assignment,
        paymentStatus: response.data.paymentStatus,
        payoutReceipts: [...receipts, response.data.receipt],
      };
      setSelectedReceipt(response.data.receipt);
      setValues((current) => ({ ...current, amount: "" }));
      onPaymentSaved?.({ ...job, staffAssignment: updatedAssignment });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not record this payout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startNewPayout = () => {
    setSelectedReceipt(null);
    setErrorMessage("");
    setValues({ amount: balance > 0 ? balance.toFixed(2) : "", paymentDate: todayInputDate(), method: "Cash", referenceNumber: "" });
  };

  const draftReceipt = { ...values };
  const previewReceipt = selectedReceipt || (canRecord && (balance > 0 || legacyPaid) ? draftReceipt : null);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          .staff-payout-print-area, .staff-payout-print-area * { visibility: visible !important; }
          .staff-payout-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Staff payment receipt
          <Typography variant="body2" color="text.secondary">{job?.jobName} - {getStaffName(assignment, staffName)}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(300px, 0.8fr) minmax(380px, 1fr)" }, gap: 2.5, alignItems: "start" }}>
            <Box>
              {selectedReceipt ? (
                <Stack spacing={1.5}>
                  <Typography fontWeight={700}>Payout receipt saved</Typography>
                  <Typography variant="body2" color="text.secondary">This receipt is saved and ready to print.</Typography>
                  {canRecord && balance > 0 && <Button variant="outlined" onClick={startNewPayout}>Record another payout</Button>}
                </Stack>
              ) : canRecord && (balance > 0 || legacyPaid) ? (
                <Stack spacing={2}>
                  <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Staff payment due</Typography>
                    <Typography fontWeight={700}>{formatAmount(amountDue)}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Paid so far</Typography>
                    <Typography fontWeight={700}>{formatAmount(legacyPaid ? amountDue : paidTotal)}</Typography>
                    {!legacyPaid && <><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Balance remaining</Typography><Typography fontWeight={700}>{formatAmount(balance)}</Typography></>}
                  </Box>
                  {legacyPaid && (
                    <Typography variant="body2" color="warning.dark">
                      This payout was marked paid before receipts were stored. Enter the historical payment details from your records to create its receipt.
                    </Typography>
                  )}
                  <TextField fullWidth required label="Amount paid (LKR)" name="amount" type="number" value={values.amount} onChange={handleChange} inputProps={{ min: 0.01, max: legacyPaid ? amountDue : balance, step: "0.01" }} disabled={legacyPaid} />
                  <TextField fullWidth required label="Payment date" name="paymentDate" type="date" value={values.paymentDate} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                  <TextField select fullWidth required label="Payment method" name="method" value={values.method} onChange={handleChange}>
                    {paymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth label="Payment reference (optional)" name="referenceNumber" value={values.referenceNumber} onChange={handleChange} inputProps={{ maxLength: 120 }} />
                  {errorMessage && <Typography color="error" variant="body2">{errorMessage}</Typography>}
                  <Button variant="contained" onClick={handleRecordPayment} disabled={saving || !values.amount || !values.paymentDate || !values.method}>
                    {saving ? "Saving..." : legacyPaid ? "Create historical receipt" : "Record payout"}
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {legacyPaid
                    ? canRecord
                      ? "This payout was marked paid before receipt history was available. Ask for the historical payment details to create its receipt."
                      : "This payout was marked paid before receipt history was available. No receipt details were saved."
                  : "No job-level receipts are on file. Use the Payroll period section for scheduled staff payouts."}
                </Typography>
              )}

              <Divider sx={{ my: 2.5 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Payout receipts</Typography>
              {receipts.length ? (
                <Stack spacing={1}>
                  {receipts.map((receipt) => (
                    <Button key={receipt._id} variant={selectedReceipt?._id === receipt._id ? "contained" : "outlined"} onClick={() => setSelectedReceipt(receipt)} sx={{ justifyContent: "space-between", textTransform: "none" }}>
                      <span>{formatDate(receipt.paymentDate)} - {formatAmount(receipt.amount)}</span>
                      <span>{receipt.method}</span>
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No saved payout receipts.</Typography>
              )}
            </Box>
            <Box sx={{ bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
                {previewReceipt && !selectedReceipt ? "Live receipt preview" : "Receipt preview"}
              </Typography>
              <Box sx={{ bgcolor: "#fff", border: "1px solid #e2e7ef", borderRadius: 2, boxShadow: "0 5px 18px rgba(24, 39, 75, 0.08)" }}>
                {previewReceipt ? (
                  <StaffPayoutReceiptDocument job={job} assignment={assignment} staffName={staffName} receipt={previewReceipt} draft={!selectedReceipt} />
                ) : (
                  <Box sx={{ p: 3, minHeight: 260, display: "grid", placeItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">Select a saved receipt to preview and print it.</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>Close</Button>
          {selectedReceipt && <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print receipt</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StaffPayoutReceiptDialog;
