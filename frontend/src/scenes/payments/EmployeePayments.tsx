import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  MenuItem,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Header from "../../components/Header";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { employeePaymentService as service } from "../../services/employeePaymentService";
import { pageContainerSx, tableSurfaceSx } from "../../styles/uiStyles";
import type { EmployeePayment, PaymentEmployee } from "../../types/payments";
import PaymentReceiptDialog, {
  money,
  PendingPaymentDialog,
} from "./PaymentDetails";
import {
  MarkPaidDialog,
  PreparePaymentDialog,
  SalaryPlanDialog,
} from "./PaymentForms";
import PaymentTable, { PaymentPager } from "./PaymentTable";
import { paymentKeys, useRefreshPayments } from "./paymentQueries";

export default function EmployeePayments() {
  const { user, hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const canReadCleaners =
    user?.scope !== "staff" && hasPermission("payroll.read");
  const canReadSalaries =
    user?.scope !== "staff" && hasPermission("salaries.read");
  const scope =
    params.get("scope") === "tenant" && canReadSalaries
      ? "tenant"
      : canReadCleaners
        ? "staff"
        : "tenant";
  const selectedId = params.get("employeeId") || "";
  const canRecord = hasPermission(
    scope === "staff" ? "payroll.record" : "salaries.record",
  );
  const [employeePage, setEmployeePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [prepareEmployee, setPrepareEmployee] =
    useState<PaymentEmployee | null>(null);
  const [salaryEmployee, setSalaryEmployee] = useState<PaymentEmployee | null>(
    null,
  );
  const [markPayment, setMarkPayment] = useState<EmployeePayment | null>(null);
  const [receipt, setReceipt] = useState<EmployeePayment | null>(null);
  const [review, setReview] = useState<EmployeePayment | null>(null);
  const enabled = Boolean(canReadCleaners || canReadSalaries);
  const employees = useServiceQuery(
    paymentKeys.employees(scope, employeePage, debouncedSearch),
    () =>
      service.employees({
        scope,
        page: employeePage,
        limit: 20,
        search: debouncedSearch || undefined,
      }),
    { enabled },
  );
  const payments = useServiceQuery(
    paymentKeys.list(scope, paymentPage, selectedId, status),
    () =>
      service.list({
        scope,
        page: paymentPage,
        limit: 20,
        employeeId: selectedId || undefined,
        status: status || undefined,
      }),
    { enabled },
  );
  const refresh = useRefreshPayments();
  const cancel = useServiceMutation(service.cancel);
  const synchronize = useServiceMutation(service.synchronize);
  const synchronizePayment = async (payment: EmployeePayment) => {
    try {
      await synchronize.mutateAsync(payment._id);
      await refresh();
    } catch {
      /* Mutation renders the API error. */
    }
  };
  const cancelPayment = async (payment: EmployeePayment) => {
    if (
      !window.confirm(
        `Cancel this pending payment for ${payment.payeeName}? Its work will become available for payment again.`,
      )
    )
      return;
    try {
      await cancel.mutateAsync(payment._id);
      await refresh();
    } catch {
      /* Mutation renders the API error. */
    }
  };
  if (!enabled) return <Navigate to="/profile" replace />;
  return (
    <Box sx={pageContainerSx}>
      <Header
        title="Employee Payments"
        subtitle="Prepare payments, record completed payments, and view paid receipts"
      />
      <Tabs
        value={scope}
        onChange={(_event, value: string) => {
          setParams({ scope: value });
          setEmployeePage(1);
          setPaymentPage(1);
          setSearch("");
        }}
        sx={{ mb: 2 }}
      >
        {canReadCleaners && <Tab value="staff" label="Cleaner payments" />}
        {canReadSalaries && <Tab value="tenant" label="Supervisor salaries" />}
      </Tabs>
      <Box sx={{ ...tableSurfaceSx, p: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {scope === "staff" ? "Cleaners" : "Supervisors"}
        </Typography>
        <TextField
          label="Search employees"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setEmployeePage(1);
          }}
          size="small"
          sx={{ mb: 2 }}
        />
        {employees.isFetching && (
          <Typography role="status">Loading employees…</Typography>
        )}
        {employees.error && (
          <Alert severity="error">{employees.error.message}</Alert>
        )}
        <Box sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>
                  {scope === "tenant" ? "Salary" : "Account"}
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.data?.employees.map((employee) => (
                <TableRow
                  key={employee._id}
                  selected={selectedId === employee._id}
                >
                  <TableCell>
                    {employee.name}
                    <Typography variant="body2">{employee.email}</Typography>
                  </TableCell>
                  <TableCell>
                    {scope === "tenant"
                      ? employee.salary
                        ? `${money(employee.salary.amount)} / ${employee.salary.frequency.toLowerCase()}`
                        : "Salary not configured"
                      : employee.status}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        onClick={() => {
                          setParams({ scope, employeeId: employee._id });
                          setPaymentPage(1);
                        }}
                      >
                        Payment history
                      </Button>
                      {canRecord && (
                        <Button
                          disabled={
                            employee.status !== "active" ||
                            (scope === "tenant" && !employee.salary)
                          }
                          onClick={() => setPrepareEmployee(employee)}
                        >
                          Prepare payment
                        </Button>
                      )}
                      {scope === "tenant" &&
                        hasPermission("salaries.manage") && (
                          <Button
                            disabled={employee.status !== "active"}
                            onClick={() => setSalaryEmployee(employee)}
                          >
                            Salary settings
                          </Button>
                        )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {employees.data?.employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No employees found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        <PaymentPager
          page={employeePage}
          total={employees.data?.paginationInfo.totalResult}
          onChange={setEmployeePage}
        />
      </Box>
      <Box sx={{ ...tableSurfaceSx, p: 2 }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 2 }}
        >
          <Typography variant="h4">Payment records</Typography>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            sx={{ minWidth: 140 }}
            onChange={(event) => {
              setStatus(event.target.value);
              setPaymentPage(1);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
          </TextField>
          {selectedId && (
            <Button
              onClick={() => {
                setParams({ scope });
                setPaymentPage(1);
              }}
            >
              Show all employees
            </Button>
          )}
        </Stack>
        {payments.isFetching && (
          <Typography role="status">Loading payments…</Typography>
        )}
        {payments.error && (
          <Alert severity="error">{payments.error.message}</Alert>
        )}
        {cancel.error && <Alert severity="error">{cancel.error.message}</Alert>}
        {synchronize.error && (
          <Alert severity="error">{synchronize.error.message}</Alert>
        )}
        {synchronize.data?.syncPending && (
          <Alert severity="warning">
            The payment is saved as paid. Some job totals still need updating;
            you can retry the update.
          </Alert>
        )}
        <PaymentTable
          payments={payments.data?.payments || []}
          canRecord={canRecord}
          onReceipt={setReceipt}
          onMarkPaid={setMarkPayment}
          onCancel={cancelPayment}
          onReview={setReview}
          onSynchronize={synchronizePayment}
          busy={cancel.isPending || synchronize.isPending}
        />
        <PaymentPager
          page={paymentPage}
          total={payments.data?.paginationInfo.totalResult}
          onChange={setPaymentPage}
        />
      </Box>
      {prepareEmployee && (
        <PreparePaymentDialog
          employee={prepareEmployee}
          onClose={() => setPrepareEmployee(null)}
        />
      )}
      {salaryEmployee && (
        <SalaryPlanDialog
          employee={salaryEmployee}
          onClose={() => setSalaryEmployee(null)}
        />
      )}
      {markPayment && (
        <MarkPaidDialog
          payment={markPayment}
          onClose={() => setMarkPayment(null)}
          onPaid={(paid) => {
            setMarkPayment(null);
            setReceipt(paid);
          }}
        />
      )}
      {receipt && (
        <PaymentReceiptDialog
          payment={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
      {review && (
        <PendingPaymentDialog
          payment={review}
          onClose={() => setReview(null)}
        />
      )}
    </Box>
  );
}
