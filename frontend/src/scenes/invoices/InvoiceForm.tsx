import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import Header from "../../components/Header";
import FormField from "../../components/forms/FormField";
import { formPageSx } from "../../styles/uiStyles";
import { errorMessage } from "../../utils/errors";
import {
  invoiceDefaults,
  invoiceFormSchema,
  type InvoiceValues,
} from "../../validation/forms";
import { useActiveClients } from "../clients/clientQueries";
import InvoicePreview from "./InvoicePreview";
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice,
} from "./invoiceQueries";

export default function InvoiceForm({
  editing = false,
}: {
  editing?: boolean;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const clients = useActiveClients();
  const query = useInvoice(editing ? id : undefined);
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<z.input<typeof invoiceFormSchema>, unknown, InvoiceValues>({
    defaultValues: invoiceDefaults,
    resolver: zodResolver(invoiceFormSchema),
  });
  const preview = useWatch({ control });
  useEffect(() => {
    const invoice = query.data?.invoice;
    if (invoice)
      reset({
        ...invoiceDefaults,
        ...invoice,
        client: invoice.client._id,
        sendDate: invoice.sendDate?.slice(0, 10) || "",
        notes: invoice.notes || "",
      });
  }, [query.data, reset]);
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      if (editing) await update.mutateAsync({ id, values });
      else await create.mutateAsync(values);
      navigate("/invoices");
    } catch (error) {
      setError(errorMessage(error));
    }
  });
  if (editing && query.isPending) return <CircularProgress />;
  if (editing && query.isError)
    return <Alert severity="error">{query.error.message}</Alert>;
  return (
    <Box sx={{ ...formPageSx, maxWidth: 1400 }}>
      <Header
        title={editing ? "Edit invoice" : "Add invoice"}
        subtitle="Invoice details and live preview"
      />
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      <Box
        component="form"
        noValidate
        onSubmit={submit}
        sx={{
          mt: 3,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
        }}
      >
        <Box>
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <FormField
                control={control}
                name="invoiceTitle"
                label="Invoice title"
              />
            </Grid>
            <Grid item xs={12}>
              <FormField
                control={control}
                name="invoiceDescription"
                label="Description"
                multiline
                minRows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <FormField control={control} name="client" label="Client" select>
                {(clients.data?.clients || []).map((client) => (
                  <MenuItem key={client._id} value={client._id}>
                    {client.firstName} {client.lastName}
                  </MenuItem>
                ))}
              </FormField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormField
                control={control}
                name="amount"
                label="Amount"
                type="number"
                inputProps={{ min: 0, step: "any" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormField
                control={control}
                name="sendDate"
                label="Send date"
                type="date"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormField
                control={control}
                name="notes"
                label="Notes"
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
          <Box
            sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}
          >
            <Button onClick={() => navigate("/invoices")}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || clients.isPending}
            >
              {editing ? "Save changes" : "Create invoice"}
            </Button>
          </Box>
        </Box>
        <InvoicePreview
          invoice={{ ...preview, amount: Number(preview.amount) || 0 }}
          client={clients.data?.clients.find(
            (client) => client._id === preview.client,
          )}
          preview
        />
      </Box>
    </Box>
  );
}
