import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import FormField from "../../components/forms/FormField";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { employeePaymentService as service } from "../../services/employeePaymentService";
import { paymentMethodSchema } from "../../types/domain";
import {
  payoutFrequencySchema,
  type EmployeePayment,
  type PaymentEmployee,
  type PaymentPreview,
} from "../../types/payments";
import {
  markPaidFormSchema,
  prepareEmployeePaymentSchema,
  salaryPlanFormSchema,
  type MarkPaidValues,
  type PrepareEmployeePayment,
  type SalaryPlanFields,
  type SalaryPlanValues,
} from "../../validation/employeePayments";
import { frequencyLabel, money, PaymentDetails } from "./PaymentDetails";
import { useRefreshPayments } from "./paymentQueries";

export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const signature = (values: PrepareEmployeePayment) =>
  JSON.stringify({
    ...values,
    jobId: values.frequency === "PerJob" ? values.jobId : "",
  });

export function PreparePaymentDialog({
  employee,
  onClose,
}: {
  employee: PaymentEmployee;
  onClose: () => void;
}) {
  const refresh = useRefreshPayments();
  const { control, handleSubmit, watch } = useForm<PrepareEmployeePayment>({
    resolver: zodResolver(prepareEmployeePaymentSchema),
    defaultValues: {
      employeeId: employee._id,
      frequency: employee.salary?.frequency || employee.frequency,
      date: today(),
      jobId: "",
    },
  });
  const values = watch();
  const [jobPage, setJobPage] = useState(1);
  const [preview, setPreview] = useState<{
    signature: string;
    payment: PaymentPreview;
  } | null>(null);
  const previewMutation = useServiceMutation(service.preview);
  const prepareMutation = useServiceMutation(service.prepare);
  const busy = previewMutation.isPending || prepareMutation.isPending;
  const jobs = useServiceQuery(
    ["employee-payments", "jobs", employee._id, jobPage],
    () => service.jobs(employee._id, { page: jobPage, limit: 20 }),
    { enabled: values.frequency === "PerJob" },
  );
  const validPreview =
    preview?.signature === signature(values) ? preview.payment : null;
  const showPreview = handleSubmit(async (input) => {
    setPreview(null);
    try {
      const result = await previewMutation.mutateAsync(input);
      setPreview({ signature: signature(input), payment: result.preview });
    } catch {
      /* Mutation renders the API error. */
    }
  });
  const prepare = handleSubmit(async (input) => {
    if (!validPreview) return;
    try {
      await prepareMutation.mutateAsync(input);
      await refresh();
      onClose();
    } catch {
      /* Mutation renders the API error. */
    }
  });
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <Box component="form" noValidate onSubmit={showPreview}>
        <DialogTitle>Prepare payment for {employee.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Preparation creates a pending record. After making the payment,
              mark it as paid to issue a receipt.
            </Alert>
            <FormField
              control={control}
              name="frequency"
              label="Payment frequency"
              select
              disabled={busy || employee.scope === "tenant"}
            >
              {payoutFrequencySchema.options
                .filter(
                  (value) =>
                    employee.scope === "staff" ||
                    value === employee.salary?.frequency,
                )
                .map((value) => (
                  <MenuItem value={value} key={value}>
                    {frequencyLabel(value)}
                  </MenuItem>
                ))}
            </FormField>
            {values.frequency !== "PerJob" && (
              <FormField
                control={control}
                name="date"
                label={
                  values.frequency === "Daily"
                    ? "Work date"
                    : values.frequency === "Weekly"
                      ? "Date in payment week (Monday–Sunday)"
                      : "Date in payment month"
                }
                type="date"
                InputLabelProps={{ shrink: true }}
                disabled={busy}
                helperText={
                  employee.scope === "tenant"
                    ? `Salary covers the full selected period, starting on or after ${employee.salary?.effectiveFrom || "the salary effective date"}.`
                    : "Periods use Asia/Colombo time. Completed shifts are grouped by their sign-in date."
                }
              />
            )}
            {values.frequency === "PerJob" && (
              <>
                <FormField
                  control={control}
                  name="jobId"
                  label="Completed job"
                  select
                  disabled={busy || jobs.isFetching}
                >
                  <MenuItem value="">Choose a completed assigned job</MenuItem>
                  {values.jobId &&
                    !jobs.data?.jobs.some(
                      (job) => job._id === values.jobId,
                    ) && (
                      <MenuItem value={values.jobId}>
                        Selected job (another page)
                      </MenuItem>
                    )}
                  {jobs.data?.jobs.map((job) => (
                    <MenuItem key={job._id} value={job._id}>
                      {job.name}
                      {job.date ? ` · ${job.date.slice(0, 10)}` : ""}
                    </MenuItem>
                  ))}
                </FormField>
                {jobs.error && (
                  <Alert severity="error">{jobs.error.message}</Alert>
                )}
                {!jobs.isFetching && jobs.data?.jobs.length === 0 && (
                  <Typography>No completed assigned jobs found.</Typography>
                )}
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    disabled={busy || jobPage <= 1 || jobs.isFetching}
                    onClick={() => setJobPage((page) => page - 1)}
                  >
                    Previous jobs
                  </Button>
                  <Typography>
                    Page {jobPage} of{" "}
                    {Math.max(1, jobs.data?.paginationInfo.totalPages || 1)}
                  </Typography>
                  <Button
                    disabled={
                      busy ||
                      jobs.isFetching ||
                      jobPage >= (jobs.data?.paginationInfo.totalPages || 1)
                    }
                    onClick={() => setJobPage((page) => page + 1)}
                  >
                    Next jobs
                  </Button>
                </Stack>
              </>
            )}
            {(previewMutation.error || prepareMutation.error) && (
              <Alert severity="error">
                {(prepareMutation.error || previewMutation.error)?.message}
              </Alert>
            )}
            {validPreview && (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <PaymentDetails payment={validPreview} />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button type="submit" disabled={busy}>
            Calculate preview
          </Button>
          <Button
            variant="contained"
            disabled={busy || !validPreview}
            onClick={prepare}
          >
            Prepare pending payment
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function SalaryPlanDialog({
  employee,
  onClose,
}: {
  employee: PaymentEmployee;
  onClose: () => void;
}) {
  const refresh = useRefreshPayments();
  const mutation = useServiceMutation((values: SalaryPlanValues) =>
    service.salary(employee._id, values),
  );
  const { control, handleSubmit } = useForm<
    SalaryPlanFields,
    undefined,
    SalaryPlanValues
  >({
    resolver: zodResolver(salaryPlanFormSchema),
    defaultValues: {
      amount: employee.salary?.amount ?? "",
      frequency: employee.salary?.frequency || "Monthly",
      effectiveFrom: employee.salary?.effectiveFrom || today(),
    },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      await refresh();
      onClose();
    } catch {
      /* Mutation renders the API error. */
    }
  });
  return (
    <Dialog
      open
      onClose={mutation.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle>Salary settings — {employee.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormField
              control={control}
              name="amount"
              label="Salary per period"
              type="number"
              inputProps={{ min: 0.01, step: 0.01 }}
              disabled={mutation.isPending}
            />
            <FormField
              control={control}
              name="frequency"
              label="Salary frequency"
              select
              disabled={mutation.isPending}
            >
              <MenuItem value="Weekly">Weekly</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
            </FormField>
            <FormField
              control={control}
              name="effectiveFrom"
              label="Effective from"
              type="date"
              InputLabelProps={{ shrink: true }}
              disabled={mutation.isPending}
              helperText="The first payable period must start on or after this date. Pending and paid amounts remain as recorded. Overlapping periods cannot be paid twice."
            />
            {mutation.error && (
              <Alert severity="error">{mutation.error.message}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
          >
            Save salary
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function MarkPaidDialog({
  payment,
  onClose,
  onPaid,
}: {
  payment: EmployeePayment;
  onClose: () => void;
  onPaid: (payment: EmployeePayment) => void;
}) {
  const refresh = useRefreshPayments();
  const mutation = useServiceMutation((values: MarkPaidValues) =>
    service.markPaid(payment._id, values),
  );
  const synchronize = useServiceMutation(service.synchronize);
  const busy = mutation.isPending || synchronize.isPending;
  const { control, handleSubmit } = useForm<MarkPaidValues>({
    resolver: zodResolver(markPaidFormSchema),
    defaultValues: {
      paymentDate: today(),
      method: "Bank Transfer",
      referenceNumber: "",
    },
  });
  const [syncPending, setSyncPending] = useState(false);
  const retrySynchronization = async () => {
    try {
      const result = await synchronize.mutateAsync(payment._id);
      await refresh();
      if (!result.syncPending) onPaid(result.payment);
    } catch {
      /* Mutation renders the API error. */
    }
  };
  const submit = handleSubmit(async (values) => {
    try {
      const result = await mutation.mutateAsync(values);
      await refresh();
      if (result.syncPending) setSyncPending(true);
      else onPaid(result.payment);
    } catch {
      /* Mutation renders the API error. */
    }
  });
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle>Mark {money(payment.amount)} as paid</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Confirm the payment to {payment.payeeName} has been made. This
              records it and issues a paid receipt. It does not transfer money.
            </Alert>
            <PaymentDetails payment={payment} />
            <FormField
              control={control}
              name="paymentDate"
              label="Payment date"
              type="date"
              InputLabelProps={{ shrink: true }}
              disabled={busy || syncPending}
            />
            <FormField
              control={control}
              name="method"
              label="Payment method"
              select
              disabled={busy || syncPending}
            >
              {paymentMethodSchema.options.map((method) => (
                <MenuItem value={method} key={method}>
                  {method}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              control={control}
              name="referenceNumber"
              label="Reference number (optional)"
              disabled={busy || syncPending}
            />
            {mutation.error && (
              <Alert severity="error">{mutation.error.message}</Alert>
            )}
            {synchronize.error && (
              <Alert severity="error">{synchronize.error.message}</Alert>
            )}
            {syncPending && (
              <Alert severity="warning">
                Payment is recorded as paid and its receipt is available. Some
                job totals could not be synchronized. Retry synchronization
                below; this will not create another payment.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Close
          </Button>
          {syncPending && mutation.data ? (
            <>
              <Button
                disabled={busy}
                onClick={() => onPaid(mutation.data.payment)}
              >
                View receipt
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={retrySynchronization}
              >
                Retry synchronization
              </Button>
            </>
          ) : (
            <Button type="submit" variant="contained" disabled={busy}>
              Confirm paid
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
