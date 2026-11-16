import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import type { EmployeePayment } from "../../types/payments";
import { useEffect } from "react";
import { frequencyLabel, money } from "./PaymentDetails";
export function PaymentPager({
  page,
  total,
  onChange,
}: {
  page: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  const lastPage =
    total === undefined ? page : Math.max(1, Math.ceil(total / 20));
  useEffect(() => {
    if (page > lastPage) onChange(lastPage);
  }, [page, lastPage, onChange]);
  return (
    <TablePagination
      component="div"
      count={total ?? -1}
      page={Math.min(page, lastPage) - 1}
      rowsPerPage={20}
      rowsPerPageOptions={[20]}
      onPageChange={(_event, next) => onChange(next + 1)}
    />
  );
}
export default function PaymentTable({
  payments,
  canRecord = false,
  onReceipt,
  onMarkPaid,
  onCancel,
  onReview,
  onSynchronize,
  busy = false,
}: {
  payments: EmployeePayment[];
  canRecord?: boolean;
  onReceipt: (payment: EmployeePayment) => void;
  onMarkPaid?: (payment: EmployeePayment) => void;
  onCancel?: (payment: EmployeePayment) => void;
  onReview?: (payment: EmployeePayment) => void;
  onSynchronize?: (payment: EmployeePayment) => void;
  busy?: boolean;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Employee / period</TableCell>
            <TableCell>Frequency</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment._id}>
              <TableCell>
                {payment.payeeName}
                <Typography variant="body2">
                  {payment.periodStart} — {payment.periodEnd}
                </Typography>
              </TableCell>
              <TableCell>{frequencyLabel(payment.frequency)}</TableCell>
              <TableCell align="right">{money(payment.amount)}</TableCell>
              <TableCell>
                {canRecord &&
                  payment.status === "Paid" &&
                  payment.jobTotalsPending && (
                    <Typography color="warning.main" variant="body2">
                      Job totals need updating
                    </Typography>
                  )}
                <Chip
                  label={payment.status === "Paid" ? "PAID" : "Pending"}
                  color={payment.status === "Paid" ? "success" : "warning"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {payment.status === "Paid" ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button onClick={() => onReceipt(payment)}>Receipt</Button>
                    {canRecord && payment.jobTotalsPending && onSynchronize && (
                      <Button
                        disabled={busy}
                        onClick={() => onSynchronize(payment)}
                      >
                        Update job totals
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {onReview && (
                      <Button onClick={() => onReview(payment)}>
                        View details
                      </Button>
                    )}
                    {canRecord && (
                      <>
                        <Button
                          disabled={busy}
                          variant="contained"
                          onClick={() => onMarkPaid?.(payment)}
                        >
                          Mark paid
                        </Button>
                        <Button
                          disabled={busy}
                          color="error"
                          onClick={() => onCancel?.(payment)}
                        >
                          Cancel pending
                        </Button>
                      </>
                    )}
                  </Stack>
                )}
              </TableCell>
            </TableRow>
          ))}
          {payments.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>No payments found.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
