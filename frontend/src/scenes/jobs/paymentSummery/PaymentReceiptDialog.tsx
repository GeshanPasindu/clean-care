import { zodResolver } from "@hookform/resolvers/zod";
import PrintIcon from "@mui/icons-material/Print";
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
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import DocumentLogo from "../../../components/DocumentLogo";
import FormField from "../../../components/forms/FormField";
import { useServiceMutation } from "../../../queries/queryHelpers";
import type { Client, Job, Receipt } from "../../../types/domain";
import { errorMessage as getErrorMessage } from "../../../utils/errors";
import {
  paymentFormSchema,
  type PaymentValues,
} from "../../../validation/forms";
import { jobService } from "../jobService";

const paymentMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

const todayInputDate = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatAmount = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return `LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

const getClientName = (
  client: Partial<Client> | undefined,
  receipt?: Partial<Receipt>,
) =>
  receipt?.clientName ||
  [client?.firstName, client?.lastName].filter(Boolean).join(" ") ||
  "Client";

const PaymentReceiptDocument = ({
  job,
  receipt,
  draft,
}: {
  job: Job | null;
  receipt?: Partial<Receipt>;
  draft?: boolean;
}) => {
  const client: Partial<Client> = job?.client || {};

  return (
    <Box
      className="payment-receipt-print-area"
      sx={{
        bgcolor: "#fff",
        color: "#15233b",
        p: { xs: 2.5, sm: 4 },
        minHeight: 520,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <DocumentLogo />
          <Typography variant="h5" fontWeight={800} color="#162440">
            Clean Care
          </Typography>
        </Box>
        <Box
          sx={{
            textAlign: { xs: "left", sm: "right" },
            minWidth: { xs: 0, sm: 130 },
            maxWidth: "100%",
          }}
        >
          <Typography
            variant="overline"
            color="text.secondary"
            fontWeight={700}
          >
            PAYMENT RECEIPT
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ overflowWrap: "anywhere" }}
          >
            {draft ? "Draft - not recorded" : receipt?._id || "Receipt"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 0.5 }}
          >
            Date paid: {formatDate(receipt?.paymentDate)}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 3, borderColor: "#dce3ed" }} />

      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        RECEIVED FROM
      </Typography>
      <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
        {getClientName(client, receipt)}
      </Typography>
      {(receipt?.clientAddress || client.address) && (
        <Typography variant="body2" color="text.secondary">
          {receipt?.clientAddress || client.address}
        </Typography>
      )}
      {(receipt?.clientEmail || client.email) && (
        <Typography variant="body2" color="text.secondary">
          {receipt?.clientEmail || client.email}
        </Typography>
      )}
      {(receipt?.clientPhoneNumber || client.phoneNumber) && (
        <Typography variant="body2" color="text.secondary">
          {receipt?.clientPhoneNumber || client.phoneNumber}
        </Typography>
      )}

      <Box
        sx={{
          mt: 3,
          borderTop: "1px solid #dce3ed",
          borderBottom: "1px solid #dce3ed",
          py: 1.5,
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          PAYMENT FOR
        </Typography>
        <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
          {receipt?.jobName || job?.jobName || "Job"}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ overflowWrap: "anywhere" }}
        >
          Job reference: {job?._id || "Not available"}
        </Typography>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={2}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            Payment method
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {receipt?.method || "Not selected"}
          </Typography>
        </Stack>
        {receipt?.referenceNumber && (
          <Stack
            direction="row"
            justifyContent="space-between"
            spacing={2}
            sx={{ mt: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              Payment reference
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ overflowWrap: "anywhere", textAlign: "right" }}
            >
              {receipt.referenceNumber}
            </Typography>
          </Stack>
        )}
      </Box>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        sx={{ py: 2 }}
      >
        <Typography variant="body1" fontWeight={700}>
          Amount received
        </Typography>
        <Typography variant="h5" fontWeight={800}>
          {formatAmount(receipt?.amount)}
        </Typography>
      </Stack>
      {draft && (
        <Typography variant="caption" color="text.secondary">
          This preview is not a receipt until the payment is recorded.
        </Typography>
      )}
    </Box>
  );
};

const PaymentReceiptDialog = ({
  open,
  job,
  onClose,
  onPaymentSaved,
}: {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onPaymentSaved?: (job: Job) => void;
}) => {
  const recordPayment = useServiceMutation(
    ({ jobId, values }: { jobId: string; values: PaymentValues }) =>
      jobService.recordClientPayment(jobId, values),
    { invalidate: [["jobs"]] },
  );
  const { control, watch, reset, setValue, handleSubmit } = useForm<
    z.input<typeof paymentFormSchema>,
    unknown,
    PaymentValues
  >({
    defaultValues: {
      amount: "",
      paymentDate: todayInputDate(),
      method: "Cash",
      referenceNumber: "",
    },
    resolver: zodResolver(
      paymentFormSchema.refine((value) => value.amount <= balance, {
        path: ["amount"],
        message: "Amount exceeds the outstanding balance",
      }),
    ),
  });
  const values = watch();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const saving = recordPayment.isPending;
  const [errorMessage, setErrorMessage] = useState("");
  const receipts = job?.receivedPayments || [];
  const totalDue = Number(job?.orgTotal || job?.payment || 0);
  const totalReceived = useMemo(
    () =>
      receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
    [receipts],
  );
  const balance = Math.max(0, totalDue - totalReceived);
  const clientName = getClientName(job?.client);

  useEffect(() => {
    if (!open) {
      setSelectedReceipt(null);
      return;
    }
    if (!selectedReceipt) {
      setErrorMessage("");
      reset({
        amount: balance > 0 ? balance.toFixed(2) : "",
        paymentDate: todayInputDate(),
        method: "Cash",
        referenceNumber: "",
      });
    }
  }, [open, job?._id, balance, selectedReceipt]);

  const handleRecordPayment = handleSubmit(async (values) => {
    if (!job) return;
    setErrorMessage("");
    try {
      const response = await recordPayment.mutateAsync({
        jobId: job._id,
        values,
      });
      const updatedJob = {
        ...job,
        receivedPayments: [...receipts, response.receipt],
      };
      setSelectedReceipt(response.receipt);
      setValue("amount", "");
      onPaymentSaved?.(updatedJob);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error) ||
          "Could not record this payment. Please try again.",
      );
    }
  });

  const showNewPayment = () => {
    setSelectedReceipt(null);
    setErrorMessage("");
    reset({
      amount: balance > 0 ? balance.toFixed(2) : "",
      paymentDate: todayInputDate(),
      method: "Cash",
      referenceNumber: "",
    });
  };

  const draftReceipt = {
    ...values,
    amount: Number(values.amount) || 0,
    paymentDate: values.paymentDate,
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          .payment-receipt-print-area, .payment-receipt-print-area * { visibility: visible !important; }
          .payment-receipt-print-area {
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
        <Box component="form" onSubmit={handleRecordPayment} noValidate>
          <DialogTitle sx={{ pb: 1 }}>
            Payment receipt
            <Typography variant="body2" color="text.secondary">
              {job?.jobName} - {clientName}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(300px, 0.8fr) minmax(380px, 1fr)",
                },
                gap: 2.5,
                alignItems: "start",
              }}
            >
              <Box>
                {selectedReceipt ? (
                  <Stack spacing={1.5}>
                    <Typography fontWeight={700}>Receipt recorded</Typography>
                    <Typography variant="body2" color="text.secondary">
                      This payment is saved. Print the receipt or start another
                      payment.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={showNewPayment}
                      disabled={balance <= 0}
                    >
                      Record another payment
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        p: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Job total
                      </Typography>
                      <Typography fontWeight={700}>
                        {formatAmount(totalDue)}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        Received so far
                      </Typography>
                      <Typography fontWeight={700}>
                        {formatAmount(totalReceived)}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        Balance remaining
                      </Typography>
                      <Typography fontWeight={700}>
                        {formatAmount(balance)}
                      </Typography>
                    </Box>
                    <FormField
                      control={control}
                      fullWidth
                      required
                      label="Amount received (LKR)"
                      name="amount"
                      type="number"

                      inputProps={{ min: 0.01, max: balance, step: "0.01" }}
                      disabled={balance <= 0}
                    />
                    <FormField
                      control={control}
                      fullWidth
                      required
                      label="Payment date"
                      name="paymentDate"
                      type="date"

                      InputLabelProps={{ shrink: true }}
                      disabled={balance <= 0}
                    />
                    <FormField
                      control={control}
                      select
                      fullWidth
                      required
                      label="Payment method"
                      name="method"

                      disabled={balance <= 0}
                    >
                      {paymentMethods.map((method) => (
                        <MenuItem key={method} value={method}>
                          {method}
                        </MenuItem>
                      ))}
                    </FormField>
                    <FormField
                      control={control}
                      fullWidth
                      label="Payment reference (optional)"
                      name="referenceNumber"

                      inputProps={{ maxLength: 120 }}
                      disabled={balance <= 0}
                    />
                    {errorMessage && (
                      <Typography color="error" variant="body2">
                        {errorMessage}
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      type="submit"
                      disabled={Boolean(
                        saving ||
                        balance <= 0 ||
                        !values.amount ||
                        !values.paymentDate ||
                        !values.method,
                      )}
                    >
                      {saving ? "Recording..." : "Record payment"}
                    </Button>
                  </Stack>
                )}

                <Divider sx={{ my: 2.5 }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Previous receipts
                </Typography>
                {receipts.length ? (
                  <Stack spacing={1}>
                    {receipts.map((receipt) => (
                      <Button
                        key={receipt._id}
                        variant={
                          selectedReceipt?._id === receipt._id
                            ? "contained"
                            : "outlined"
                        }
                        onClick={() => setSelectedReceipt(receipt)}
                        sx={{
                          justifyContent: "space-between",
                          textTransform: "none",
                        }}
                      >
                        <span>
                          {formatDate(receipt.paymentDate)} -{" "}
                          {formatAmount(receipt.amount)}
                        </span>
                        <span>{receipt.method}</span>
                      </Button>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No client payments have been recorded for this job.
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  bgcolor: "background.default",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {selectedReceipt ? "Receipt preview" : "Live receipt preview"}
                </Typography>
                <Box
                  sx={{
                    bgcolor: "#fff",
                    border: "1px solid #e2e7ef",
                    borderRadius: 2,
                    boxShadow: "0 5px 18px rgba(24, 39, 75, 0.08)",
                  }}
                >
                  <PaymentReceiptDocument
                    job={job}
                    receipt={selectedReceipt || draftReceipt}
                    draft={!selectedReceipt}
                  />
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose}>Close</Button>
            {selectedReceipt && (
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
              >
                Print receipt
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};

export default PaymentReceiptDialog;
