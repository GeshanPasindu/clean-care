import { Alert, Box, Typography } from "@mui/material";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Header from "../../components/Header";
import { useServiceQuery } from "../../queries/queryHelpers";
import { employeePaymentService } from "../../services/employeePaymentService";
import { pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import type { EmployeePayment } from "../../types/payments";
import PaymentReceiptDialog from "./PaymentDetails";
import PaymentTable, { PaymentPager } from "./PaymentTable";
import { paymentKeys } from "./paymentQueries";
export default function MyPayments() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState<EmployeePayment | null>(null);
  const payments = useServiceQuery(
    paymentKeys.receipts(page),
    () => employeePaymentService.receipts({ page, limit: 20 }),
    { enabled: user?.scope !== "platform" },
  );
  if (user?.scope === "platform")
    return <Navigate to="/employee-payments" replace />;
  return (
    <Box sx={pageContainerSx}>
      <Header
        title="My Payments"
        subtitle="Receipts for payments made to you"
      />
      {payments.isFetching && (
        <Typography role="status">Loading receipts…</Typography>
      )}
      {payments.error && (
        <Alert severity="error">{payments.error.message}</Alert>
      )}
      <Box sx={tableSurfaceSx}>
        <PaymentTable
          payments={(payments.data?.payments || []).filter(
            (payment) => payment.status === "Paid",
          )}
          onReceipt={setReceipt}
        />
        <PaymentPager
          page={page}
          total={payments.data?.paginationInfo.totalResult}
          onChange={setPage}
        />
      </Box>
      {receipt && (
        <PaymentReceiptDialog
          payment={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </Box>
  );
}
