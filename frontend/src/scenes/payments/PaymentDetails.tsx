import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { EmployeePayment, PaymentPreview } from "../../types/payments";
import DocumentLogo from "../../components/DocumentLogo";

export const money = (amount: number) =>
  `LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const frequencyLabel = (value: string) =>
  value === "PerJob" ? "Per job" : value;
export function PaymentDetails({ payment }: { payment: PaymentPreview }) {
  return (
    <>
      <Typography variant="h5">{payment.payeeName}</Typography>
      <Typography>
        {payment.kind === "Salary" ? "Supervisor salary" : "Cleaner payment"} ·{" "}
        {frequencyLabel(payment.frequency)}
      </Typography>
      <Typography>
        {payment.periodStart} — {payment.periodEnd}
      </Typography>
      <Typography variant="h4" sx={{ my: 2 }}>
        Total: {money(payment.amount)}
      </Typography>
      {payment.entries.length > 0 && (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job / work date</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Hourly pay</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payment.entries.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {entry.jobName}
                    <Typography variant="body2">
                      {entry.signInTime
                        ? new Date(entry.signInTime).toLocaleString("en-GB", {
                            timeZone: "Asia/Colombo",
                          })
                        : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>{entry.hours}</TableCell>
                  <TableCell>{money(entry.hourRate)}</TableCell>
                  <TableCell align="right">{money(entry.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  );
}
export function PendingPaymentDialog({
  payment,
  onClose,
}: {
  payment: EmployeePayment;
  onClose: () => void;
}) {
  if (payment.status !== "Pending") return null;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Prepared payment details</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          This payment is pending. A paid receipt will be issued after the
          payment is marked paid.
        </Alert>
        <PaymentDetails payment={payment} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
export default function PaymentReceiptDialog({
  payment,
  onClose,
}: {
  payment: EmployeePayment;
  onClose: () => void;
}) {
  if (payment.status !== "Paid") return null;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Payment receipt</DialogTitle>
      <DialogContent>
        <style>{`@media print {
      body * { visibility: hidden !important; }
      .employee-payment-receipt, .employee-payment-receipt * { visibility: visible !important; }
      .employee-payment-receipt { position: absolute; inset: 0; width: 100%; }
      .MuiDialog-container, .MuiDialog-paper, .MuiDialogContent-root { position: static !important; overflow: visible !important; max-height: none !important; box-shadow: none !important; }
    }`}</style>
        <Box
          className="employee-payment-receipt"
          sx={{ p: 3, color: "#172033", backgroundColor: "white" }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box>
              <DocumentLogo />
              <Typography variant="h5" fontWeight={800}>
                Clean Care
              </Typography>
            </Box>
            <Typography variant="h5">Payment receipt</Typography>
          </Stack>
          <Chip label="PAID" color="success" sx={{ my: 2 }} />
          <Typography>{payment.receiptNumber}</Typography>
          <PaymentDetails payment={payment} />
          <Typography sx={{ mt: 2 }}>
            Paid on {payment.paymentDate} · {payment.method}
          </Typography>
          {payment.referenceNumber && (
            <Typography>Reference: {payment.referenceNumber}</Typography>
          )}
          {payment.paidAt && (
            <Typography variant="body2">
              Recorded: {new Date(payment.paidAt).toLocaleString()}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={() => window.print()}>Print receipt</Button>
      </DialogActions>
    </Dialog>
  );
}
