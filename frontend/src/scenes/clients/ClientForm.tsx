import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, CircularProgress, Grid } from "@mui/material";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header";
import FormField from "../../components/forms/FormField";
import { formPageSx } from "../../styles/uiStyles";
import { errorMessage } from "../../utils/errors";
import {
  clientDefaults,
  clientFormSchema,
  type ClientValues,
} from "../../validation/forms";
import { useClient, useCreateClient, useUpdateClient } from "./clientQueries";

const fields = [
  ["firstName", "First name"],
  ["lastName", "Last name (optional)"],
  ["email", "Email"],
  ["address", "Address"],
  ["phoneNumber", "Phone number"],
  ["contactName", "Contact name"],
  ["contactPhoneNumber", "Contact phone"],
  ["contactEmail", "Contact email"],
  ["accountManager", "Account manager"],
  ["notes", "Notes"],
] as const;
export default function ClientForm({ editing = false }: { editing?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useClient(editing ? id : undefined);
  const create = useCreateClient();
  const update = useUpdateClient();
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ClientValues>({
    defaultValues: clientDefaults,
    resolver: zodResolver(clientFormSchema),
  });
  useEffect(() => {
    if (query.data?.client) reset({ ...clientDefaults, ...query.data.client });
  }, [query.data, reset]);
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      if (editing) await update.mutateAsync({ id, values });
      else await create.mutateAsync(values);
      navigate("/clients");
    } catch (error) {
      setError(errorMessage(error));
    }
  });
  if (editing && query.isPending) return <CircularProgress />;
  if (editing && query.isError)
    return <Alert severity="error">{query.error.message}</Alert>;
  return (
    <Box sx={formPageSx}>
      <Header
        title={editing ? "Edit client" : "Add client"}
        subtitle="Client and contact details"
      />
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
        <Grid container spacing={2.5}>
          {fields.map(([name, label]) => (
            <Grid
              item
              xs={12}
              md={name === "notes" || name === "address" ? 12 : 6}
              key={name}
            >
              <FormField
                control={control}
                name={name}
                label={label}
                type={name.toLowerCase().includes("email") ? "email" : "text"}
                multiline={name === "notes" || name === "address"}
                minRows={name === "notes" ? 3 : undefined}
              />
            </Grid>
          ))}
        </Grid>
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}
        >
          <Button onClick={() => navigate("/clients")}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {editing ? "Save changes" : "Create client"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
