import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import axios from "axios";
import { getAccessToken } from "../../auth/apiClient";
import { environment } from "../../environment";
import logo from "../../assets/logo/logo.png";

const paymentMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];
const PAYROLL_TIMEZONE_OFFSET_MS = 330 * 60 * 1000;

const localDateInput = (date = new Date()) => {
  return new Date(date.getTime() + PAYROLL_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);
};

const dateOnly = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Colombo" });
};

const amountText = (value) => `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceiptDocument = ({ payout, staff, preview, draft = false }) => {
  const payeeName = payout?.payeeName || staff?.name || "Staff member";
  const entries = payout?.entries || preview?.entries || [];
  const paidAmount = payout?.amount ?? preview?.totalAmount ?? 0;
  const periodStart = payout?.periodStart || preview?.period?.startDate || preview?.period?.periodStart;
  const periodEnd = payout?.periodEnd || preview?.period?.endDate || preview?.period?.periodEnd;

  return (
    <Box className={draft ? "staff-payroll-preview" : "staff-payroll-print-area"} sx={{ bgcolor: "#fff", color: "#15233b", p: { xs: 2, sm: 3 }, border: "1px solid #dce3ed", borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Box component="img" src={logo} alt="Clean Care logo" sx={{ display: "block", width: 120, maxHeight: 48, objectFit: "contain", objectPosition: "left center", mb: 0.5 }} />
          <Typography variant="h6" fontWeight={800} color="#162440">Clean Care</Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>STAFF PAYMENT RECEIPT</Typography>
          <Typography variant="body2" fontWeight={700}>{draft ? "Draft — not recorded" : payout?.receiptNumber || "Receipt"}</Typography>
          <Typography variant="caption" color="text.secondary" display="block">Paid: {dateOnly(payout?.paymentDate)}</Typography>
        </Box>
      </Stack>
      <Divider sx={{ my: 2, borderColor: "#dce3ed" }} />
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>PAID TO</Typography>
          <Typography fontWeight={700}>{payeeName}</Typography>
          {(payout?.payeeEmail || staff?.email) && <Typography variant="body2" color="text.secondary">{payout?.payeeEmail || staff.email}</Typography>}
        </Box>
        <Box sx={{ textAlign: { sm: "right" } }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>PAY PERIOD</Typography>
          <Typography fontWeight={700}>{dateOnly(periodStart)} – {dateOnly(periodEnd)}</Typography>
          <Typography variant="body2" color="text.secondary">{payout?.payFrequency || staff?.payFrequency || "Weekly"} schedule</Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 2, overflowX: "auto" }}>
        <Table size="small" aria-label="Payroll receipt work details">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Job / shift</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Hours</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={`${entry.jobName}-${entry.signInTime || "shift"}-${index}`}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{entry.jobName || "Job"}</Typography>
                  {entry.description && <Typography variant="caption" color="text.secondary">{entry.description}</Typography>}
                </TableCell>
                <TableCell>{dateOnly(entry.signInTime || entry.jobDate)}</TableCell>
                <TableCell align="right">{Number(entry.hours || 0).toFixed(2)}</TableCell>
                <TableCell align="right">{amountText(entry.hourRate)}</TableCell>
                <TableCell align="right">{amountText(entry.amount)}</TableCell>
              </TableRow>
            ))}
            {!entries.length && <TableRow><TableCell colSpan={5} align="center">No payable work in this period</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 2, py: 1.5, borderTop: "1px solid #dce3ed" }}>
        <Box>
          <Typography variant="body2" color="text.secondary">{payout?.method || "Payment method not selected"}</Typography>
          {payout?.referenceNumber && <Typography variant="caption" color="text.secondary">Reference: {payout.referenceNumber}</Typography>}
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="body2" color="text.secondary">TOTAL PAID</Typography>
          <Typography variant="h5" fontWeight={800}>{amountText(paidAmount)}</Typography>
        </Box>
      </Stack>
      {draft && <Typography variant="caption" color="text.secondary">This preview is not a receipt until payroll is recorded.</Typography>}
    </Box>
  );
};

const StaffPayrollSection = ({ staffId, isStaffView, onSaved }) => {
  const [staff, setStaff] = useState({ name: "Staff member", payFrequency: "Weekly" });
  const [period, setPeriod] = useState({ startDate: "", endDate: "" });
  const [preview, setPreview] = useState({ entries: [], totalHours: 0, totalAmount: 0, payouts: [] });
  const [previewRange, setPreviewRange] = useState({ startDate: "", endDate: "" });
  const [payment, setPayment] = useState({ paymentDate: localDateInput(), method: "Cash", referenceNumber: "" });
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const endpoint = useMemo(() => `${environment.apiUrl}/job/staffPayroll/${staffId || "self"}`, [staffId]);

  const fetchPayroll = useCallback(async ({ useCurrentPeriod = false } = {}) => {
    if (!staffId) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams();
      if (!useCurrentPeriod && period.startDate && period.endDate) {
        params.set("startDate", period.startDate);
        params.set("endDate", period.endDate);
      }
      const query = params.toString();
      const response = await axios.get(`${endpoint}${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = response.data;
      setStaff(data.staff || { name: "Staff member", payFrequency: "Weekly" });
      setPeriod({
        startDate: String(data.period?.periodStart || "").slice(0, 10),
        endDate: String(data.period?.periodEnd || "").slice(0, 10),
      });
      setPreviewRange({
        startDate: String(data.period?.periodStart || "").slice(0, 10),
        endDate: String(data.period?.periodEnd || "").slice(0, 10),
      });
      setPreview({
        entries: data.entries || [],
        totalHours: Number(data.totalHours || 0),
        totalAmount: Number(data.totalAmount || 0),
        payouts: data.payouts || [],
      });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not load payroll details.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, period.endDate, period.startDate, staffId]);

  useEffect(() => {
    fetchPayroll({ useCurrentPeriod: true });
    // The initial period comes from the employee's stored schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, endpoint]);

  const handleRecordPayout = async () => {
    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await axios.post(endpoint, {
        periodStart: period.startDate,
        periodEnd: period.endDate,
        ...payment,
      }, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      setSelectedPayout(response.data.payout);
      setStatusMessage(response.data.projectionSyncPending
        ? "Receipt saved. Some job payment statuses could not be refreshed; reload the page to sync them."
        : "Payroll recorded. The receipt is ready to print.");
      await fetchPayroll();
      onSaved?.();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not record payroll. Refresh the preview and try again.");
    } finally {
      setSaving(false);
    }
  };

  const canPay = !isStaffView
    && preview.totalAmount > 0
    && period.startDate
    && period.endDate
    && previewRange.startDate === period.startDate
    && previewRange.endDate === period.endDate
    && payment.paymentDate
    && payment.method;
  const previewMatchesPeriod = previewRange.startDate === period.startDate && previewRange.endDate === period.endDate;
  const displayedPreview = previewMatchesPeriod
    ? preview
    : { ...preview, entries: [], totalHours: 0, totalAmount: 0 };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          .staff-payroll-print-area, .staff-payroll-print-area * { visibility: visible !important; }
          .staff-payroll-print-area { position: fixed !important; inset: 0 !important; width: 100% !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; background: #fff !important; }
        }
      `}</style>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mb: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Payroll period</Typography>
            <Typography variant="body2" color="text.secondary">The default is the most recently completed week or month. Adjust the dates for another period.</Typography>
          </Box>
          <Chip color="primary" variant="outlined" label={`${staff.payFrequency || "Weekly"} schedule`} />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
          <TextField label="Period from" type="date" value={period.startDate} onChange={(event) => setPeriod((current) => ({ ...current, startDate: event.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="Period to" type="date" value={period.endDate} onChange={(event) => setPeriod((current) => ({ ...current, endDate: event.target.value }))} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" onClick={() => fetchPayroll()} disabled={loading || !period.startDate || !period.endDate}>
            {loading ? "Loading…" : "Preview period"}
          </Button>
          {!isStaffView && (
            <TextField label="Payment date" type="date" value={payment.paymentDate} onChange={(event) => setPayment((current) => ({ ...current, paymentDate: event.target.value }))} InputLabelProps={{ shrink: true }} />
          )}
        </Box>
        {!isStaffView && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 1.5, mb: 2 }}>
            <TextField select label="Payment method" value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>
              {paymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
            </TextField>
            <TextField label="Payment reference (optional)" value={payment.referenceNumber} onChange={(event) => setPayment((current) => ({ ...current, referenceNumber: event.target.value.slice(0, 120) }))} />
          </Box>
        )}
        {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
        {statusMessage && <Alert severity={statusMessage.startsWith("Receipt saved.") ? "warning" : "success"} sx={{ mb: 2 }}>{statusMessage}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: isStaffView ? "1fr" : "minmax(0, 1fr) minmax(340px, 0.9fr)" }, gap: 2, alignItems: "start" }}>
          <Box>
            <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
              <Box><Typography variant="caption" color="text.secondary">Unpaid shifts</Typography><Typography variant="h6" fontWeight={700}>{displayedPreview.entries.length}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Hours</Typography><Typography variant="h6" fontWeight={700}>{displayedPreview.totalHours.toFixed(2)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Payable</Typography><Typography variant="h6" fontWeight={700}>{amountText(displayedPreview.totalAmount)}</Typography></Box>
            </Stack>
            <Box sx={{ maxHeight: 290, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell>Job / date</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                <TableBody>
                  {displayedPreview.entries.map((entry, index) => (
                    <TableRow key={`${entry.jobName}-${entry.signInTime || "shift"}-${index}`}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{entry.jobName}</Typography><Typography variant="caption" color="text.secondary">{dateOnly(entry.signInTime)}</Typography></TableCell>
                      <TableCell align="right">{Number(entry.hours).toFixed(2)}</TableCell>
                      <TableCell align="right">{amountText(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {!displayedPreview.entries.length && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>{loading ? "Loading payroll…" : previewMatchesPeriod ? "No unpaid completed shifts in this period." : "Choose Preview period to load this date range."}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
            {!isStaffView && (
              <Button
                variant="contained"
                startIcon={<ReceiptLongOutlinedIcon />}
                sx={{ mt: 1.5 }}
                onClick={handleRecordPayout}
                disabled={!canPay || saving}
              >
                {saving ? "Recording…" : "Record payout for selected period"}
              </Button>
            )}
          </Box>
          {!isStaffView && (
            <ReceiptDocument
              payout={{
                ...payment,
                payeeName: staff.name,
                payFrequency: staff.payFrequency,
                periodStart: period.startDate,
                periodEnd: period.endDate,
              }}
              staff={staff}
              preview={{ ...displayedPreview, period }}
              draft
            />
          )}
        </Box>
        <Divider sx={{ my: 2.5 }} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Payroll receipts</Typography>
        {!preview.payouts.length ? (
          <Typography variant="body2" color="text.secondary">No period payouts have been recorded yet.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Period</TableCell><TableCell>Paid on</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Receipt</TableCell></TableRow></TableHead>
              <TableBody>
                {preview.payouts.map((payout) => (
                  <TableRow key={payout._id}>
                    <TableCell>{dateOnly(payout.periodStart)} – {dateOnly(payout.periodEnd)}</TableCell>
                    <TableCell>{dateOnly(payout.paymentDate)}</TableCell>
                    <TableCell>{payout.method}</TableCell>
                    <TableCell align="right">{amountText(payout.amount)}</TableCell>
                    <TableCell align="right"><Button size="small" startIcon={<PrintIcon />} onClick={() => setSelectedPayout(payout)}>View / print</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={Boolean(selectedPayout)} onClose={() => setSelectedPayout(null)} maxWidth="md" fullWidth>
        <DialogTitle>Staff payment receipt</DialogTitle>
        <DialogContent dividers>{selectedPayout && <ReceiptDocument payout={selectedPayout} staff={staff} />}</DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPayout(null)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print receipt</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StaffPayrollSection;
